"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, projects, projectTags, projectMembers, users, userProfiles } from "@/db/schema";
import { findProjectPostById } from "@/lib/queries/post";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyNewProject } from "@/lib/notifications/notify";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";

type PublishProject = {
  slug: string;
  title: string;
  iconUrl: string | null;
  authorId: string;
  visibility: string;
};

/** 下書き→公開の初回公開時のみ、作者フォロワーへ新プロジェクト通知を送る */
async function maybeNotifyPublish(db: any, project: PublishProject, newSlug: string, newVisibility: string | undefined): Promise<void> {
  if (project.visibility !== "draft") return;
  if (newVisibility !== "public" && newVisibility !== "unlisted") return;

  const author = await db
    .select({ displayName: userProfiles.displayName, username: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, project.authorId))
    .get();

  const authorName = author?.displayName || author?.username || "";
  await notifyNewProject(db, { ...project, slug: newSlug, title: project.title }, authorName);
}

// ---- プロジェクト作成 ----

/**
 * 新しいプロジェクト（Mod/Plugin）を作成する Server Action。
 */
export const createProject = async (formData: FormData) => {
  const { db, session } = await getAuthenticatedDb();

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    tags:        formData.getAll("tags"),
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, slug, description, descriptionFormat, type, license, sourceUrl, links, tags } = parsed.data;
  const id = createId();

  const existingProject = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.kind, "project"), eq(posts.slug, slug)))
    .get();
  if (existingProject) {
    const t = await getServerErrors();
    return { error: { slug: [t("project.slugTaken")] } };
  }

  // posts と projects は必ず同時に作る。D1 は transaction() が使えないため batch を使う。
  // 片方だけが残ると「kind=project なのに projects に行が無い」状態になり、FK では防げない。
  await db.batch([
    db.insert(posts).values({
      id,
      authorId:   session.user.id,
      kind:       "project",
      slug,
      title:      name,
      body:       description,
      bodyFormat: descriptionFormat || "markdown",
      visibility: "draft",
    }),
    db.insert(projects).values({
      id,
      type,
      license,
      sourceUrl:  sourceUrl || null,
      links:      links || null,
      iconUrl:    formData.get("iconUrl") as string | null,
    }),
  ]);

  if (tags.length > 0) {
    await db.insert(projectTags).values(
      tags.map((tag) => ({ projectId: id, tag }))
    ).run();
  }

  revalidatePath("/projects");
  redirect(`/projects/${slug}`);
};

// ---- プロジェクト更新 ----

/**
 * 既存のプロジェクト情報を更新する Server Action。
 */
export const updateProject = async (projectId: string, formData: FormData) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);

  if (!project) throw new Error("Project not found");

  await assertProjectAccess(db, project, session);

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    status:      formData.get("status"),
    modrinthId:  formData.get("modrinthId") || null,
    curseforgeId: formData.get("curseforgeId") || null,
    githubRepo:  formData.get("githubRepo") || null,
    discordWebhookUrl: formData.get("discordWebhookUrl") || null,
    issueTrackerUrl: formData.get("issueTrackerUrl") || null,
    tags:        formData.getAll("tags"),
  };

  const parsed = updateProjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { tags, githubRepo, discordWebhookUrl, ...fields } = parsed.data;
  const t = await getServerErrors();

  let normalizedWebhook: string | null = null;
  if (discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@/lib/notifications/discord");
    if (!isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return { error: { discordWebhookUrl: [t("project.invalidDiscordWebhook")] } };
    }
    normalizedWebhook = discordWebhookUrl;
  }

  let normalizedGithubRepo: string | null = null;
  if (githubRepo) {
    const { normalizeGithubRepo } = await import("@/lib/utils/github");
    normalizedGithubRepo = normalizeGithubRepo(githubRepo);
    if (!normalizedGithubRepo) {
      return { error: { githubRepo: [t("project.invalidGithubRepo")] } };
    }
  }

  let previousSlugToSet: string | undefined = undefined;
  if (fields.slug && fields.slug !== project.slug) {
    const existingSlug = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.kind, "project"), eq(posts.slug, fields.slug)))
      .get();
    if (existingSlug) return { error: { slug: [t("project.slugTaken")] } };
    previousSlugToSet = project.slug;
  }

  // 共通カラムは posts、Project 固有のカラムは projects へ。
  // 2 つの UPDATE がちぐはぐな状態で残らないよう batch でまとめる。
  const { name, description, descriptionFormat, status, ...projectFields } = fields;

  await db.batch([
    db
      .update(posts)
      .set({
        ...(name !== undefined ? { title: name } : {}),
        ...(description !== undefined ? { body: description } : {}),
        ...(descriptionFormat !== undefined ? { bodyFormat: descriptionFormat } : {}),
        ...(status !== undefined ? { visibility: status } : {}),
        ...(fields.slug !== undefined ? { slug: fields.slug } : {}),
        ...(previousSlugToSet !== undefined ? { previousSlug: previousSlugToSet } : {}),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, project.id)),
    db
      .update(projects)
      .set({
        ...projectFields,
        issueTrackerUrl: fields.issueTrackerUrl !== undefined ? fields.issueTrackerUrl : project.issueTrackerUrl,
        sourceUrl: fields.sourceUrl || null,
        links: fields.links || null,
        githubRepo: normalizedGithubRepo,
        discordWebhookUrl: normalizedWebhook,
        commentsEnabled: formData.get("commentsEnabled") === "on",
        recipesEnabled: formData.get("recipesEnabled") === "on",
        iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
      })
      .where(eq(projects.id, project.id)),
  ]);

  if (tags !== undefined) {
    const previousTags = await db
      .select({ tag: projectTags.tag })
      .from(projectTags)
      .where(eq(projectTags.projectId, project.id))
      .all();

    await db.delete(projectTags).where(eq(projectTags.projectId, project.id)).run();

    await recordDeletion(
      db,
      "project_tags",
      previousTags.map((t: { tag: string }) => buildRecordKey(project.id, t.tag))
    );

    if (tags.length > 0) {
      await db.insert(projectTags).values(
        tags.map((tag) => ({ projectId: project.id, tag }))
      ).run();
    }
  }

  await maybeNotifyPublish(db, project, fields.slug ?? project.slug, fields.status);

  revalidatePath(`/projects/${fields.slug ?? project.slug}`);
  revalidatePath(`/projects/${fields.slug ?? project.slug}/edit`);
  revalidatePath("/projects");
  return { success: true };
};

// ---- プロジェクトのアイコン更新 ----

/**
 * プロジェクトのアイコン画像を更新する Server Action。
 */
export const updateProjectIcon = async (projectId: string, iconUrl: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Not found");

  await assertProjectAccess(db, project, session);

  // iconUrl は projects、updatedAt は posts と、更新先が分かれる
  await db.batch([
    db.update(projects).set({ iconUrl }).where(eq(projects.id, projectId)),
    db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, projectId)),
  ]);
  revalidatePath(`/[locale]/projects/[slug]`, "page");
  return { success: true };
};

// ---- オーナー権限の譲渡 ----

/**
 * プロジェクトのオーナー権限を別のユーザーへ譲渡する Server Action。
 */
export const transferOwnership = async (projectId: string, newOwnerId: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Not found");

  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden: Only owner can transfer ownership");
  }

  const targetUser = await db.select().from(users).where(eq(users.id, newOwnerId)).get();
  if (!targetUser) throw new Error("User not found");

  await db.update(posts).set({ authorId: newOwnerId, updatedAt: new Date() }).where(eq(posts.id, projectId));

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, newOwnerId)));
  await recordDeletion(db, "project_members", buildRecordKey(projectId, newOwnerId));

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
};

// ---- 一括操作 ----

/**
 * 複数のプロジェクトの公開ステータスを一括変更する Server Action。
 */
export const batchUpdateProjectStatus = async (projectIds: string[], status: "public" | "unlisted" | "private" | "draft") => {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  // 公開範囲も作者も posts が持つため、projects を触る必要がない
  const isOwnerCondition = eq(posts.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(posts.id, projectIds) : and(inArray(posts.id, projectIds), isOwnerCondition);

  await db.update(posts).set({ visibility: status, updatedAt: new Date() }).where(conditions).run();
  
  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
};

/**
 * 複数のプロジェクトを一括削除する Server Action。
 */
export const batchDeleteProjects = async (projectIds: string[]) => {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  const isOwnerCondition = eq(posts.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(posts.id, projectIds) : and(inArray(posts.id, projectIds), isOwnerCondition);

  const deletable = await db.select({ id: posts.id }).from(posts).where(conditions).all();

  // posts を削除すると projects は cascade で消える。逆向きに消すと posts が孤児になる
  await db.delete(posts).where(conditions).run();

  await recordDeletion(db, "posts", deletable.map((p: { id: string }) => p.id));

  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
};
