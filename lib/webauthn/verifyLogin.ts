import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { eq } from "drizzle-orm";
import { verifyAuthentication } from "@/lib/services/auth";
import { getRpContext } from "./config";
import { getChallenge, clearChallenge } from "./challenge";

export interface PasskeyUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
}

/**
 * パスキーのログインアサーションを検証し、成功時にユーザー情報を返す。
 * 検証は外部入力の境界処理であるため呼び出し元で例外を処理する。
 *
 * @deprecated 廃止予定。暗号検証は modparks-auth サイドカー（lib/services/auth.ts）へ
 * 移設済みで、この関数は互換のために DB 参照＋サイドカー呼び出しを束ねる薄い
 * ラッパーとして残している。将来的には呼び出し側をサイドカー直呼びへ寄せる想定。
 */
export const verifyPasskeyLogin = async (response: AuthenticationResponseJSON): Promise<PasskeyUser | null> => {
  const { rpId, origin } = await getRpContext();
  const expectedChallenge = await getChallenge("auth");
  if (!expectedChallenge) return null;

  const { getDatabase } = await import("@/lib/db");
  const db = await getDatabase();
  const { authenticators, users, userProfiles } = await import("@/db/schema");

  const auth = await db.select().from(authenticators).where(eq(authenticators.credentialID, response.id)).get();
  if (!auth) return null;

  const verification = await verifyAuthentication({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    authenticator: {
      credentialID: auth.credentialID,
      credentialPublicKey: auth.credentialPublicKey,
      counter: auth.counter,
      transports: auth.transports ? JSON.parse(auth.transports) : undefined,
    },
  });

  await clearChallenge("auth");
  if (!verification.verified) return null;

  await db
    .update(authenticators)
    .set({ counter: verification.newCounter })
    .where(eq(authenticators.credentialID, auth.credentialID));

  const record = await db
    .select()
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, auth.userId))
    .get();
  if (!record?.users || record.users.deletedAt) return null;

  const user = record.users;
  const profile = record.user_profiles;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    username: profile?.username ?? undefined,
    displayName: profile?.displayName ?? undefined,
    avatarUrl: profile?.avatarUrl ?? undefined,
    role: user.role,
  };
};
