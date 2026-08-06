import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import type { Database } from "@/lib/db";

/** users.role の管理者値。DB とセッションの双方で同じ文字列を使う */
export const ADMIN_ROLE = "admin";

/**
 * セッション上のロールで管理者かを判定する。
 *
 * セッションの role は JWT に載った発行時点の値なので、DB 側で降格しても
 * 再ログインまで反映されない。取り消しの効かない操作では {@link isAdminUser} を使う。
 */
export const isAdminSession = (session: Session | null | undefined): boolean =>
  session?.user?.role === ADMIN_ROLE;

/**
 * DB 上のロールで管理者かを判定する。常に最新の値を見る。
 * @param db データベース接続
 * @param userId 判定対象のユーザーID
 */
export async function isAdminUser(db: Database, userId: string): Promise<boolean> {
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  return user?.role === ADMIN_ROLE;
}
