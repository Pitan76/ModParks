"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { users, apiKeys, accounts, rateLimits } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function updateProfile(data: { displayName: string, bio: string, avatarUrl: string, links: string, locale: "ja" | "en" }) {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(users).set({
    displayName: data.displayName,
    bio: data.bio,
    avatarUrl: data.avatarUrl || null,
    links: data.links,
    locale: data.locale,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
}

export async function generateApiKey(name: string) {
  const { db, userId } = await getAuthenticatedDb();

  const rawKey = "mp_" + crypto.randomUUID().replace(/-/g, "");
  
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  await db.insert(apiKeys).values({
    key: hashedKey,
    name: name,
    userId: userId,
  });

  revalidatePath("/settings");
  return { success: true, key: rawKey };
}

export async function deleteApiKey(id: string) {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  revalidatePath("/settings");
  return { success: true };
}

export async function disconnectGitHub() {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")));

  revalidatePath("/settings");
  return { success: true };
}

export async function toggleGithubVisibility(show: boolean) {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { error: "User not found" };

  const customObj = (user.custom as Record<string, any>) || {};
  customObj.showGithubLink = show;

  await db.update(users).set({ custom: customObj }).where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
}

export async function changeUsername(newId: string) {
  const { db, userId } = await getAuthenticatedDb();

  // Validation: format check
  if (!/^[a-zA-Z0-9-_]+$/.test(newId)) {
    return { error: "errorIdFormat" };
  }

  // Check if taken
  const existing = await db.select().from(users).where(
    or(eq(users.username, newId), eq(users.previousUsername, newId))
  ).get();

  if (existing) {
    return { error: "errorIdTaken" };
  }

  // M-4: 30 days cooldown for username changes
  const rateLimitId = `username_change:${userId}`;
  const now = Date.now();
  const rlRecord = await db.select().from(rateLimits).where(eq(rateLimits.id, rateLimitId)).get();
  if (rlRecord && rlRecord.expiresAt.getTime() > now) {
    return { error: "errorRateLimit" }; // Need to add translation or just fail
  }

  if (rlRecord) {
    await db.update(rateLimits).set({ expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000) }).where(eq(rateLimits.id, rateLimitId));
  } else {
    await db.insert(rateLimits).values({ id: rateLimitId, expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000) });
  }

  const currentUser = await db.select().from(users).where(eq(users.id, userId)).get();
  
  await db.update(users).set({
    username: newId,
    previousUsername: currentUser?.username || null
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function changeEmail(newEmail: string, password?: string) {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.passwordHash) {
    if (!password) return { error: "errorWrongPassword" };
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return { error: "errorWrongPassword" };
  }

  const existing = await db.select().from(users).where(eq(users.email, newEmail)).get();
  if (existing) {
    return { error: "errorEmailTaken" };
  }

  await db.update(users).set({ email: newEmail }).where(eq(users.id, userId));
  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(oldPass: string, newPass: string, totpToken?: string) {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.passwordHash) {
    const match = await bcrypt.compare(oldPass, user.passwordHash);
    if (!match) return { error: "errorWrongPassword" };
  }

  if (user?.twoFactorEnabled && user?.twoFactorSecret) {
    if (!totpToken) return { error: "INVALID_CODE" };
    const { TOTP } = await import("otpauth");
    const totp = new TOTP({ secret: user.twoFactorSecret });
    const delta = totp.validate({ token: totpToken, window: 1 });
    if (delta === null) return { error: "INVALID_CODE" };
  }

  const hashed = await bcrypt.hash(newPass, 12);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAccount() {
  const { db, userId } = await getAuthenticatedDb();

  const res = await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId)).returning();
  return { success: true };
}

export async function generateTotpSecret() {
  const { db, session, userId } = await getAuthenticatedDb();
  const { TOTP, Secret } = await import("otpauth");

  const secret = new Secret();
  const totp = new TOTP({
    issuer: "ModParks",
    label: session.user.email || session.user.username || "User",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  await db.update(users).set({ twoFactorSecret: secret.base32 }).where(eq(users.id, userId));

  return { uri: totp.toString() };
}

export async function verifyAndEnableTotp(token: string) {
  const { db, userId } = await getAuthenticatedDb();
  const { TOTP } = await import("otpauth");

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("2fa_verify", 10, 5 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !user.twoFactorSecret) {
    return { error: "NO_SETUP" };
  }

  const totp = new TOTP({ secret: user.twoFactorSecret });
  const delta = totp.validate({ token, window: 1 });

  if (delta === null) {
    return { error: "INVALID_CODE" };
  }

  await db.update(users).set({
    twoFactorEnabled: true,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function disableTotp(passwordOrToken: string) {
  const { db, userId } = await getAuthenticatedDb();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user || !user.twoFactorEnabled) return { success: true };

  let isAuthorized = false;

  // Check password if exists
  if (user.passwordHash) {
    isAuthorized = await bcrypt.compare(passwordOrToken, user.passwordHash);
  }
  
  // If password failed or doesn't exist, check TOTP token
  if (!isAuthorized && user.twoFactorSecret) {
    const { TOTP } = await import("otpauth");
    const totp = new TOTP({ secret: user.twoFactorSecret });
    const delta = totp.validate({ token: passwordOrToken, window: 1 });
    if (delta !== null) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { error: "UNAUTHORIZED" };
  }

  await db.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function updatePostingSettings(status: "draft" | "public" | "unlisted" | "private", license: string) {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(users).set({
    defaultProjectStatus: status,
    defaultLicense: license,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}
