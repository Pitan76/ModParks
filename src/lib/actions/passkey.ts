"use server";

import type { RegistrationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateRegistrationOptions, verifyRegistration } from "@/lib/services/auth";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { authenticators } from "@/db/schema";
import { getRpContext } from "@/lib/webauthn/config";
import { setChallenge, getChallenge, clearChallenge } from "@/lib/webauthn/challenge";

export interface PasskeyInfo {
  credentialID: string;
  name: string | null;
  createdAt: Date | null;
}

/**
 * ログインユーザーの登録済みパスキー一覧を返す。
 */
export const listPasskeys = async (): Promise<PasskeyInfo[]> => {
  const { db, userId } = await getAuthenticatedDb();
  const rows = await db
    .select({ credentialID: authenticators.credentialID, name: authenticators.name, createdAt: authenticators.createdAt })
    .from(authenticators)
    .where(eq(authenticators.userId, userId));
  return rows;
};

/**
 * パスキー登録用の PublicKeyCredentialCreationOptions を生成する。
 * 既存パスキーは excludeCredentials で重複登録を防ぐ。
 *
 * @deprecated 廃止予定。option 生成は modparks-auth サイドカー
 * （lib/services/auth.ts）へ移設済み。この関数は DB 参照＋サイドカー呼び出しを
 * 束ねる互換ラッパーとして残している。
 */
export const startPasskeyRegistration = async () => {
  const { db, session, userId } = await getAuthenticatedDb();
  const { rpId, rpName } = await getRpContext();

  const existing = await db.select().from(authenticators).where(eq(authenticators.userId, userId));

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userID: userId,
    userName: session.user.email || session.user.username || userId,
    userDisplayName: session.user.displayName || session.user.username || userId,
    excludeCredentials: existing.map((a) => ({
      id: a.credentialID,
      transports: a.transports ? (JSON.parse(a.transports) as AuthenticatorTransportFuture[]) : undefined,
    })),
  });

  await setChallenge("reg", options.challenge);
  return options;
};

/**
 * ブラウザから返された登録レスポンスを検証し、パスキーを保存する。
 *
 * @deprecated 廃止予定。暗号検証は modparks-auth サイドカー
 * （lib/services/auth.ts）へ移設済み。この関数は検証結果を DB へ保存する
 * 互換ラッパーとして残している。
 */
export const finishPasskeyRegistration = async (response: RegistrationResponseJSON, name: string) => {
  const { db, userId } = await getAuthenticatedDb();
  const { rpId, origin } = await getRpContext();

  const expectedChallenge = await getChallenge("reg");
  if (!expectedChallenge) return { error: "CHALLENGE_EXPIRED" };

  const verification = await verifyRegistration({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
  });

  await clearChallenge("reg");
  if (!verification.verified || !verification.registrationInfo) return { error: "VERIFICATION_FAILED" };

  const info = verification.registrationInfo;
  await db.insert(authenticators).values({
    credentialID: info.credentialID,
    userId,
    providerAccountId: userId,
    credentialPublicKey: info.credentialPublicKey,
    counter: info.counter,
    credentialDeviceType: info.credentialDeviceType,
    credentialBackedUp: info.credentialBackedUp,
    transports: response.response.transports ? JSON.stringify(response.response.transports) : null,
    name: name.trim() || null,
    createdAt: new Date(),
  });

  revalidatePath("/settings");
  return { success: true };
};

/**
 * 指定したパスキーの表示名を変更する。
 */
export const renamePasskey = async (credentialID: string, name: string) => {
  const { db, userId } = await getAuthenticatedDb();
  await db
    .update(authenticators)
    .set({ name: name.trim() || null })
    .where(and(eq(authenticators.userId, userId), eq(authenticators.credentialID, credentialID)));
  revalidatePath("/settings");
  return { success: true };
};

/**
 * 指定したパスキーを削除する。
 */
export const deletePasskey = async (credentialID: string) => {
  const { db, userId } = await getAuthenticatedDb();
  await db
    .delete(authenticators)
    .where(and(eq(authenticators.userId, userId), eq(authenticators.credentialID, credentialID)));
  revalidatePath("/settings");
  return { success: true };
};
