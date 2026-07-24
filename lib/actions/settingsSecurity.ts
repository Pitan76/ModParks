"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { users, userProfiles, userSettings, rateLimits } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword, comparePassword, validateTotpToken, provisionTotp } from "@/lib/services/auth";

/**
 * ユーザー名の変更を行う Server Action。
 */
export const changeUsername = async (newId: string) => {
  const { db, userId } = await getAuthenticatedDb();

  if (!/^[a-zA-Z0-9-_]+$/.test(newId)) return { error: "errorIdFormat" };

  const existing = await db.select().from(userProfiles).where(
    or(eq(userProfiles.username, newId), eq(userProfiles.previousUsername, newId))
  ).get();

  if (existing) return { error: "errorIdTaken" };

  const rateLimitId = `username_change:${userId}`;
  const now = Date.now();
  const rlRecord = await db.select().from(rateLimits).where(eq(rateLimits.id, rateLimitId)).get();
  if (rlRecord && rlRecord.expiresAt.getTime() > now) return { error: "errorRateLimit" };

  if (rlRecord) {
    await db.update(rateLimits).set({ expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000) }).where(eq(rateLimits.id, rateLimitId));
  } else {
    await db.insert(rateLimits).values({ id: rateLimitId, expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000) });
  }

  const currentProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  
  await db.update(userProfiles).set({
    username: newId,
    previousUsername: currentProfile?.username || null
  }).where(eq(userProfiles.userId, userId));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * メールアドレス의 変更を行う Server Action。
 */
export const changeEmail = async (newEmail: string, password?: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.passwordHash) {
    if (!password) return { error: "errorWrongPassword" };
    const match = await comparePassword(password, user.passwordHash);
    if (!match) return { error: "errorWrongPassword" };
  } else {
    return { error: "errorSetPasswordFirst" };
  }

  const existing = await db.select().from(users).where(eq(users.email, newEmail)).get();
  if (existing) return { error: "errorEmailTaken" };

  await db.update(users).set({ email: newEmail }).where(eq(users.id, userId));
  revalidatePath("/settings");
  return { success: true };
};

/**
 * パスワードの変更を行う Server Action。
 */
export const changePassword = async (oldPass: string, newPass: string, totpToken?: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.passwordHash) {
    const match = await comparePassword(oldPass, user.passwordHash);
    if (!match) return { error: "errorWrongPassword" };
  }

  if (user?.twoFactorEnabled && user?.twoFactorSecret) {
    if (!totpToken) return { error: "INVALID_CODE" };
    if (!(await validateTotpToken(user.twoFactorSecret, totpToken))) return { error: "INVALID_CODE" };
  }

  const hashed = await hashPassword(newPass, 8);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * アカウントの退会/論理削除を行う Server Action。
 */
export const deleteAccount = async (passwordOrToken?: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { success: false };

  let isAuthorized = false;

  if (user.passwordHash) {
    if (!passwordOrToken) return { error: "errorWrongPassword" };
    isAuthorized = await comparePassword(passwordOrToken, user.passwordHash);
  } else {
    if (!user.twoFactorEnabled) return { error: "errorSetPasswordFirst" };
  }

  if (!isAuthorized && user.twoFactorSecret && passwordOrToken) {
    if (await validateTotpToken(user.twoFactorSecret, passwordOrToken)) isAuthorized = true;
  }

  if ((user.passwordHash || user.twoFactorEnabled) && !isAuthorized) return { error: "UNAUTHORIZED" };

  const timestamp = Date.now();
  const scrambledEmail = user.email ? `deleted_${timestamp}_${user.email}` : null;
  const scrambledGithubId = user.githubId ? `deleted_${timestamp}_${user.githubId}` : null;

  await db.update(users).set({ 
    deletedAt: new Date(),
    email: scrambledEmail,
    githubId: scrambledGithubId
  }).where(eq(users.id, userId));

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  if (profile) {
    await db.update(userProfiles).set({
      username: `deleted_${timestamp}_${profile.username}`
    }).where(eq(userProfiles.userId, userId));
  }

  return { success: true };
};

/**
 * TOTP(2段階認証)シークレットキーと登録用URIを生成する Server Action。
 */
export const generateTotpSecret = async () => {
  const { db, session, userId } = await getAuthenticatedDb();

  const { base32, uri } = await provisionTotp(
    session.user.email || session.user.username || "User"
  );

  await db.update(users).set({ twoFactorSecret: base32 }).where(eq(users.id, userId));

  return { uri };
};

/**
 * 送信された2FA確認コードを検証し、2FAを有効化する Server Action。
 */
export const verifyAndEnableTotp = async (token: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("2fa_verify", 10, 5 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !user.twoFactorSecret) return { error: "NO_SETUP" };

  if (!(await validateTotpToken(user.twoFactorSecret, token))) return { error: "INVALID_CODE" };

  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * 2段階認証を無効化する Server Action。
 */
export const disableTotp = async (passwordOrToken: string) => {
  const { db, userId } = await getAuthenticatedDb();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user || !user.twoFactorEnabled) return { success: true };

  let isAuthorized = false;

  if (user.passwordHash) {
    isAuthorized = await comparePassword(passwordOrToken, user.passwordHash);
  }
  
  if (!isAuthorized && user.twoFactorSecret) {
    if (await validateTotpToken(user.twoFactorSecret, passwordOrToken)) isAuthorized = true;
  }

  if (!isAuthorized) return { error: "UNAUTHORIZED" };

  await db.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
};
