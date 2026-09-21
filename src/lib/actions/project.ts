"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, projects, projectTags, projectMembers, users } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { createProjectSchema, updateDescriptionSchema } from "@modparks/core/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { isAdminSession } from "@/lib/auth/roles";
import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { detectSourceLocale } from "@modparks/core/translation/detectLocale";
import { FormReader } from "@modparks/core/forms/formReader";
import { buildProjectCreateInput } from "@modparks/core/forms/projectFormInput";
import { updateProject as updateProjectCore } from "@modparks/core/projects/updateProject";
import { getNextPushSender } from "@/lib/services/push";

// ---- プロジェクト作成 ----

/**
 * 新しいプロジェクト（Mod/Plugin）を作成する Server Action。
 */
export async function createProject(formData: FormData) {
  const { db, session } = await getAuthenticatedDb();

  const form = new FormReader(formData);
  const parsed = createProjectSchema.safeParse(buildProjectCreateInput(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, slug, description, descriptionFormat, type, license, sourceUrl, links, tags, githubReleaseImportMode, aiGenerated } = parsed.data;
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
      // UI のロケールではなく本文から推定する。日本語UIの作者が英語で書くこともあるため
      sourceLocale: detectSourceLocale(`${name}
${description}`),
      visibility: "draft",
    }),
    db.insert(projects).values({
      id,
      type,
      license,
      sourceUrl:  sourceUrl || null,
      links:      links || null,
      iconUrl:    form.text("iconUrl") ?? null,
      githubReleaseImportMode: githubReleaseImportMode || "link",
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
  const [t, push] = await Promise.all([getServerErrors(), getNextPushSender()]);

  const outcome = await updateProjectCore({ notify: { db, push }, t }, projectId, formData, session.user.id);

  // Server Action の契約を保つ。見つからない・権限なしは例外、検証エラーは { error } で返す
  if (outcome.type === "notFound") throw new Error("Project not found");
  if (outcome.type === "forbidden") throw new Error("Forbidden");
  if (outcome.type === "invalid") return { error: outcome.error };

  revalidatePath(`/projects/${outcome.slug}`);
  revalidatePath(`/projects/${outcome.slug}/edit`);
  revalidatePath("/projects");
  return { success: true };
};

// ---- 説明の更新 ----

/**
 * 説明タブの内容（原文・書式・原文の言語・AI 翻訳の可否）を更新する Server Action。
 *
 * 基本情報とは別のフォームなので、更新するカラムもここで完結させる。
 */
export const updateProjectDescription = async (projectId: string, formData: FormData) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");
  await assertProjectAccess(db, project, session);

  const parsed = updateDescriptionSchema.safeParse({
    description:       formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    sourceLocale:      formData.get("sourceLocale"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  let resolvedSourceLocale = parsed.data.sourceLocale;
  if (resolvedSourceLocale === "auto") {
    resolvedSourceLocale = detectSourceLocale(`${project.title}\n${parsed.data.description}`);
  }

  await db
    .update(posts)
    .set({
      body:         parsed.data.description,
      bodyFormat:   parsed.data.descriptionFormat,
      sourceLocale: resolvedSourceLocale,
      // 未チェックのスイッチは送られてこないため、値の有無で判定する
      aiTranslationEnabled: formData.get("aiTranslationEnabled") === "on",
    })
    .where(eq(posts.id, projectId));

  revalidatePath(`/projects/${project.slug}`);
  revalidatePath(`/projects/${project.slug}/edit`);
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

  // iconUrl を更新
  await db.update(projects).set({ iconUrl }).where(eq(projects.id, projectId));
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

  await db.update(posts).set({ authorId: newOwnerId }).where(eq(posts.id, projectId));

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, newOwnerId)));
  await recordDeletion(db, "project_members", buildRecordKey(projectId, newOwnerId));

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
};
