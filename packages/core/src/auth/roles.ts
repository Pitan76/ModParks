import { users } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { eq } from "drizzle-orm";

/** users.role の管理者値。DB とセッションの双方で同じ文字列を使う */
export const ADMIN_ROLE = "admin";

/**
 * DB 上のロールで管理者かを判定する。常に最新の値を見る。
 *
 * セッションのロールで判定するものは Next 側の lib/auth/roles.ts にある。
 * あちらは next-auth の Session 型拡張に依存するため core には置けない。
 * @param db データベース接続
 * @param userId 判定対象のユーザーID
 */
export async function isAdminUser(db: Database, userId: string): Promise<boolean> {
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();

  return user?.role === ADMIN_ROLE;
}
