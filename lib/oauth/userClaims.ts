/**
 * id_token / userinfo に載せるユーザー情報。
 * どちらも同じ集合を返さないと、クライアント側で突き合わせたときに食い違う。
 */
import { getDatabase } from "@/lib/db";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserClaims = {
  sub: string;
  name: string | null;
  preferred_username: string | null;
  picture: string | null;
  email?: string | null;
  email_verified?: boolean;
};

/**
 * スコープに応じたクレームを組み立てる。email は email スコープがあるときだけ載せる。
 */
export async function buildUserClaims(userId: string, scopes: readonly string[]): Promise<UserClaims | null> {
  const db = await getDatabase();
  const row = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, userId))
    .get();

  if (!row) return null;

  const claims: UserClaims = {
    sub: row.id,
    name: row.displayName,
    preferred_username: row.username,
    picture: row.avatarUrl,
  };

  if (scopes.includes("email")) {
    claims.email = row.email;
    claims.email_verified = !!row.emailVerified;
  }

  return claims;
}
