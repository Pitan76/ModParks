import { and, eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { projectMembers } from "@modparks/core/db/schema";
import { isAdminUser } from "@modparks/core/auth/roles";

/**
 * プロジェクトを編集してよいか。作者・管理者・メンバーのいずれかなら真。
 *
 * 例外を投げずに真偽値で返す。Next 側の assertProjectAccess は 19 箇所から
 * 呼ばれ「Forbidden を投げる」契約なので、そちらはこれに委譲して投げ方だけを保つ。
 * 管理者とメンバーの判定は DB を見る（セッションのロールは古い可能性がある）。
 * @param db データベース接続
 * @param project 対象プロジェクト
 * @param userId 操作者のユーザーID
 */
export async function canEditProject(db: Database, project: { id: string; authorId: string }, userId: string): Promise<boolean> {
  if (project.authorId === userId) return true;
  if (await isAdminUser(db, userId)) return true;

  const member = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
    .get();

  return !!member;
}
