"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { projects, projectTags, projectMembers, users, userProfiles } from "@/db/schema";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyNewProject } from "@/lib/notifications/notify";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";

type PublishProject = {
  slug: string;
  name: string;
  iconUrl: string | null;
  authorId: string;
  status: string;
};

/** 下書き→公開の初回公開時のみ、作者フォロワーへ新プロジェクト通知を送る */
const maybeNotifyPublish = async (
  db: any,
  project: PublishProject,
  newSlug: string,
  newStatus: string | undefined,
): Promise<void> => {
  if (project.status !== "draft") return;
  if (newStatus !== "public" && newStatus !== "unlisted") return;

  const author = await db
    .select({ displayName: userProfiles.displayName, username: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, project.authorId))
    .get();

  const authorName = author?.displayName || author?.username || "";
  await notifyNewProject(db, { ...project, slug: newSlug, name: project.name }, authorName);
};

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

  const existingProject = await db.select().from(projects).where(eq(projects.slug, slug)).get();
  if (existingProject) return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };

  await db.insert(projects).values({
    id,
    slug,
    name,
    description,
    descriptionFormat: descriptionFormat || "markdown",
    type,
    license,
    sourceUrl:  sourceUrl || null,
    links:      links || null,
    iconUrl:    formData.get("iconUrl") as string | null,
    authorId:   session.user.id,
    status:     "draft",
  }).run();

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

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

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

  let normalizedWebhook: string | null = null;
  if (discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@/lib/notifications/discord");
    if (!isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return { error: { discordWebhookUrl: ["Discord の Webhook URL を入力してください。"] } };
    }
    normalizedWebhook = discordWebhookUrl;
  }

  let normalizedGithubRepo: string | null = null;
  if (githubRepo) {
    const { normalizeGithubRepo } = await import("@/lib/utils/github");
    normalizedGithubRepo = normalizeGithubRepo(githubRepo);
    if (!normalizedGithubRepo) {
      return { error: { githubRepo: ["'owner/repo' 形式、または GitHub リポジトリの URL を入力してください。"] } };
    }
  }

  let previousSlugToSet: string | undefined = undefined;
  if (fields.slug && fields.slug !== project.slug) {
    const existingSlug = await db.select().from(projects).where(eq(projects.slug, fields.slug)).get();
    if (existingSlug) return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };
    previousSlugToSet = project.slug;
  }

  await db
    .update(projects)
    .set({
      ...fields,
      issueTrackerUrl: fields.issueTrackerUrl !== undefined ? fields.issueTrackerUrl : project.issueTrackerUrl,
      sourceUrl: fields.sourceUrl || null,
      links: fields.links || null,
      githubRepo: normalizedGithubRepo,
      discordWebhookUrl: normalizedWebhook,
      commentsEnabled: formData.get("commentsEnabled") === "on",
      recipesEnabled: formData.get("recipesEnabled") === "on",
      iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
      updatedAt: new Date(),
      ...(previousSlugToSet !== undefined ? { previousSlug: previousSlugToSet } : {})
    })
    .where(eq(projects.id, project.id))
    .run();

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

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  await assertProjectAccess(db, project, session);

  await db.update(projects).set({ iconUrl, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath(`/[locale]/projects/[slug]`, "page");
  return { success: true };
};

// ---- オーナー権限の譲渡 ----

/**
 * プロジェクトのオーナー権限を別のユーザーへ譲渡する Server Action。
 */
export const transferOwnership = async (projectId: string, newOwnerId: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden: Only owner can transfer ownership");
  }

  const targetUser = await db.select().from(users).where(eq(users.id, newOwnerId)).get();
  if (!targetUser) throw new Error("User not found");

  await db.update(projects).set({ authorId: newOwnerId, updatedAt: new Date() }).where(eq(projects.id, projectId));

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

  const isOwnerCondition = eq(projects.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(projects.id, projectIds) : and(inArray(projects.id, projectIds), isOwnerCondition);

  await db.update(projects).set({ status, updatedAt: new Date() }).where(conditions).run();
  
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

  const isOwnerCondition = eq(projects.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(projects.id, projectIds) : and(inArray(projects.id, projectIds), isOwnerCondition);

  const deletable = await db.select({ id: projects.id }).from(projects).where(conditions).all();

  await db.delete(projects).where(conditions).run();

  await recordDeletion(db, "projects", deletable.map((p: { id: string }) => p.id));

  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
};
