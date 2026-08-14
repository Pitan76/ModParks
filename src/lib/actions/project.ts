"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, projects, projectTags, projectMembers, users } from "@/db/schema";
import { findProjectPostById } from "@/lib/queries/post";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { isAdminSession } from "@/lib/auth/roles";
import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import {
  normalizeExternalLinks,
  resolveSlugChange,
  syncProjectTags,
  maybeNotifyPublish,
} from "@/lib/actions/projectUpdateHelpers";

// ---- プロジェクト作成 ----

/**
 * 新しいプロジェクト（Mod/Plugin）を作成する Server Action。
 */
export async function createProject(formData: FormData) {
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
    aiGenerated: formData.get("aiGenerated") === "on",
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, slug, description, descriptionFormat, type, license, sourceUrl, links, tags, aiGenerated } = parsed.data;
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
      aiGenerated: !!aiGenerated,
    }),
  ]);

  if (tags.length > 0) {
    await db.insert(projectTags).values(
      tags.map((tag) => ({ projectId: id, tag }))
    ).run();
  }

  revalidatePath("/projects");
  redirect({ href: `/projects/${slug}`, locale: await getLocale() });
}

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
    aiGenerated: formData.get("aiGenerated") !== null ? formData.get("aiGenerated") === "on" : undefined,
  };

  const parsed = updateProjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { tags, githubRepo, discordWebhookUrl, ...fields } = parsed.data;

  const links = await normalizeExternalLinks(githubRepo, discordWebhookUrl);
  if ("error" in links) return links;

  const slugChange = await resolveSlugChange(db, project.slug, fields.slug);
  if ("error" in slugChange) return slugChange;
  const previousSlugToSet = slugChange.previousSlug;

  // 共通カラムは posts、Project 固有のカラムは projects へ。
  // 2 つの UPDATE がちぐはぐな状態で残らないよう batch でまとめる。
  const { name, description, descriptionFormat, status, ...projectFields } = fields;

  // 下書きの間は「作成しただけ」の状態なので、他のステータスへ移した時点を作成日時とみなす
  const isLeavingDraft = project.visibility === "draft" && status !== undefined && status !== "draft";

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
        ...(isLeavingDraft ? { createdAt: new Date() } : {}),
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
        githubRepo: links.githubRepo,
        discordWebhookUrl: links.discordWebhookUrl,
        commentsEnabled: formData.get("commentsEnabled") === "on",
        recipesEnabled: formData.get("recipesEnabled") === "on",
        iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
        aiGenerated: fields.aiGenerated !== undefined ? !!fields.aiGenerated : undefined,
      })
      .where(eq(projects.id, project.id)),
  ]);

  if (tags !== undefined) await syncProjectTags(db, project.id, tags);

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

  if (project.authorId !== session.user.id && !isAdminSession(session)) {
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
