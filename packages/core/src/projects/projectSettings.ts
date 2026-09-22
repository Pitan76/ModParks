import { eq, and } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { posts, projects, projectMembers, users } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { isAdminUser } from "@modparks/core/auth/roles";
import { updateDescriptionSchema } from "@modparks/core/validations";
import { detectSourceLocale } from "@modparks/core/translation/detectLocale";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";

/**
 * プロジェクト編集画面の、基本情報以外の設定（説明・アイコン・所有権の譲渡）の本体。
 * Next の Server Action と modparks-api の両方から呼ぶ。
 *
 * 見つからない・権限なしは移設前の Server Action と同じく例外で伝える（画面側は例外として扱っている）。
 * 戻り値の slug はキャッシュを無効化する呼び出し側のためのもの。
 */

async function loadEditableProject(db: Database, projectId: string, userId: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");
  if (!(await canEditProject(db, project, userId))) throw new Error("Forbidden");

  return project;
}

/**
 * 説明タブの内容（原文・書式・原文の言語・AI 翻訳の可否）を更新する。
 * 基本情報とは別のフォームなので、更新するカラムもここで完結させる。
 */
export async function updateProjectDescription(db: Database, userId: string, projectId: string, formData: FormData) {
  const project = await loadEditableProject(db, projectId, userId);

  const parsed = updateDescriptionSchema.safeParse({
    description:       formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    sourceLocale:      formData.get("sourceLocale"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { description, descriptionFormat, sourceLocale } = parsed.data;
  await db
    .update(posts)
    .set({
      body:         description,
      bodyFormat:   descriptionFormat,
      sourceLocale: sourceLocale === "auto" ? detectSourceLocale(`${project.title}\n${description}`) : sourceLocale,
      // 未チェックのスイッチは送られてこないため、値の有無で判定する
      aiTranslationEnabled: formData.get("aiTranslationEnabled") === "on",
    })
    .where(eq(posts.id, projectId));

  return { success: true as const, slug: project.slug };
}

/** アイコン画像を更新する */
export async function updateProjectIcon(db: Database, userId: string, projectId: string, iconUrl: string) {
  const project = await loadEditableProject(db, projectId, userId);
  await db.update(projects).set({ iconUrl }).where(eq(projects.id, projectId));

  return { success: true as const, slug: project.slug };
}

/**
 * オーナー権限を別のユーザーへ譲渡する。
 * 譲渡はプロジェクトを手放す操作なので、編集権限（メンバー）ではなく所有者か管理者に限る。
 * 管理者の判定はトークンの値を信じず DB で行う。
 */
export async function transferOwnership(db: Database, userId: string, projectId: string, newOwnerId: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Not found");
  if (project.authorId !== userId && !(await isAdminUser(db, userId))) {
    throw new Error("Forbidden: Only owner can transfer ownership");
  }

  const targetUser = await db.select({ id: users.id }).from(users).where(eq(users.id, newOwnerId)).get();
  if (!targetUser) throw new Error("User not found");

  await db.update(posts).set({ authorId: newOwnerId }).where(eq(posts.id, projectId));

  // 新しい所有者がメンバーにもいると二重になるので外す
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, newOwnerId)));
  await recordDeletion(db, "project_members", buildRecordKey(projectId, newOwnerId));

  return { success: true as const, slug: project.slug };
}
