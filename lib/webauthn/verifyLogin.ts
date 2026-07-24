import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
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

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(auth.credentialID),
      credentialPublicKey: isoBase64URL.toBuffer(auth.credentialPublicKey),
      counter: auth.counter,
      transports: auth.transports ? JSON.parse(auth.transports) : undefined,
    },
  });

  await clearChallenge("auth");
  if (!verification.verified) return null;

  await db
    .update(authenticators)
    .set({ counter: verification.authenticationInfo.newCounter })
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
