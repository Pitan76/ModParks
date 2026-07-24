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
 * 監査ログに非正規化して残すためのメールアドレスを取得します。
 *
 * 監査ログは users への外部キーを持たない（復元時のカスケード削除を避けるため）ので、
 * users が入れ替わってもログを読めるよう、操作時点の値を控えておきます。
 * 取得失敗はログ記録の付加情報が欠けるだけなので、例外にせず undefined を返します。
 */
export async function getAuditEmail(db: any, userId: string): Promise<string | undefined> {
  try {
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const user = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    return user?.email ?? undefined;
  } catch {
    return undefined;
  }
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

/**
 * 管理者権限に加えて TOTP による再認証を要求するヘルパー。
 * シークレットの操作など、影響が大きく取り消しの効かない操作で使用します。
 *
 * 2要素認証が未設定の管理者は実行できません（設定を促す）。
 */
export async function getReauthenticatedAdminDb(totpToken: string) {
  const { db, session, userId } = await getAdminDb();
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled, twoFactorSecret: users.twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    throw new Error("TWO_FACTOR_REQUIRED");
  }
  if (!totpToken) throw new Error("INVALID_CODE");

  const { validateTotpToken } = await import("@/lib/services/auth");
  if (!(await validateTotpToken(user.twoFactorSecret, totpToken))) {
    throw new Error("INVALID_CODE");
  }

  return { db, session, userId };
}

/**
 * プロジェクトの編集権限（オーナー、メンバー、管理者）を確認するヘルパー。
 * 権限がない場合は "Forbidden" エラーをスローします。
 */
export async function assertProjectAccess(db: any, project: { id: string; authorId: string }, session: any) {
  if (project.authorId === session.user.id) {
    return true; // Author
  }
  
  const { users, projectMembers } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  
  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).get();
  if (dbUser?.role === "admin") {
    return true; // Admin
  }

  const member = await db.select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id)))
    .get();
  
  if (!member) {
    throw new Error("Forbidden");
  }
  return true; // Member
}
