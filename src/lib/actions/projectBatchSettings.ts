"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";

export type BatchProjectSettingsUpdates = {
  license?: string;
  discordWebhookUrl?: string | null;
  aiGenerated?: boolean;
  commentsEnabled?: boolean;
  recipesEnabled?: boolean;
};

/**
 * ログインユーザーが管理可能なプロジェクトIDのみを抽出する
 */
async function getManageableProjects(db: Database, session: Session, projectIds: string[]) {
  let query = db
    .select({ id: posts.id })
    .from(posts)
    .where(inArray(posts.id, projectIds));

  // 管理者でない場合は自分が作成者であるもののみ
  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    // @ts-ignore
    query = query.where(eq(posts.authorId, session.user.id));
  }

  return await query.all();
}

/**
 * 選択した複数プロジェクトの各種設定を一括で更新する Server Action
 */
export async function batchUpdateProjectSettings(
  projectIds: string[],
  updates: BatchProjectSettingsUpdates
): Promise<ActionResult<{ successCount: number }>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  if (projectIds.length === 0) return { error: t("version.batch.noSelection") };

  const targets = await getManageableProjects(db, session, projectIds);
  if (targets.length === 0) return { error: t("common.forbidden") };

  const targetIds = targets.map((p) => p.id);

  // 指定された updates の値だけを取り出してセットするオブジェクトを構築
  const setClause: Record<string, any> = {};
  if (updates.license !== undefined) setClause.license = updates.license;
  if (updates.discordWebhookUrl !== undefined) setClause.discordWebhookUrl = updates.discordWebhookUrl;
  if (updates.aiGenerated !== undefined) setClause.aiGenerated = updates.aiGenerated;
  if (updates.commentsEnabled !== undefined) setClause.commentsEnabled = updates.commentsEnabled;
  if (updates.recipesEnabled !== undefined) setClause.recipesEnabled = updates.recipesEnabled;

  if (Object.keys(setClause).length === 0) {
    return { success: true, data: { successCount: 0 } };
  }

  await db
    .update(projects)
    .set(setClause)
    .where(inArray(projects.id, targetIds))
    .run();

  revalidatePath("/projects/manage");
  return { success: true, data: { successCount: targetIds.length } };
}
