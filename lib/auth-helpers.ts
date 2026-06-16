import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

/**
 * 認証済みセッションとDBインスタンスを一括で取得するヘルパー。
 * 未ログインの場合は "Unauthorized" エラーをスローします。
 */
export async function getAuthenticatedDb() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDatabase();
  return { db, session, userId: session.user.id };
}

/**
 * 管理者権限を必要とする操作のためのヘルパー。
 * 管理者でない場合は "Forbidden" エラーをスローします。
 */
export async function getAdminDb() {
  const { db, session, userId } = await getAuthenticatedDb();
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  if (user?.role !== "admin") throw new Error("Forbidden");
  return { db, session, userId };
}
