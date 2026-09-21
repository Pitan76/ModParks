import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { users } from "@modparks/core/db/schema";

/**
 * アカウントがセッションを使ってよい状態かを DB で判定する。
 *
 * Next 側は Auth.js の jwt コールバックで 5 分ごとに同じ判定を行い、
 * 削除・停止・凍結されたユーザーのセッションを session コールバックで捨てている。
 * トークン内のフラグはその再検査の結果でしかなく、Next を通らない経路では
 * 更新されない。Next の外で セッションを検証するときはトークンを信用せず、
 * 必ずこれで最新の状態を確かめること。
 * @param db データベース接続
 * @param userId 判定対象のユーザーID
 */
export async function isAccountActive(db: Database, userId: string): Promise<boolean> {
  const row = await db
    .select({ deletedAt: users.deletedAt, deactivatedAt: users.deactivatedAt, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!row) return false;

  return !row.deletedAt && !row.deactivatedAt && !row.suspendedAt;
}
