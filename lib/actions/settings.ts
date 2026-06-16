"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { users, apiKeys, accounts } from "@/db/schema";
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

  const keyStr = "mp_" + crypto.randomUUID().replace(/-/g, "");

  await db.insert(apiKeys).values({
    key: keyStr,
    name: name,
    userId: userId,
  });

  revalidatePath("/settings");
  return { success: true, key: keyStr };
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

  const currentUser = await db.select().from(users).where(eq(users.id, userId)).get();
  
  await db.update(users).set({
    username: newId,
    previousUsername: currentUser?.username || null
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function changeEmail(newEmail: string) {
  const { db, userId } = await getAuthenticatedDb();

  const existing = await db.select().from(users).where(eq(users.email, newEmail)).get();
  if (existing) {
    return { error: "errorEmailTaken" };
  }

  await db.update(users).set({ email: newEmail }).where(eq(users.id, userId));
  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(oldPass: string, newPass: string) {
  const { db, userId } = await getAuthenticatedDb();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.passwordHash) {
    const match = await bcrypt.compare(oldPass, user.passwordHash);
    if (!match) return { error: "errorWrongPassword" };
  }

  const hashed = await bcrypt.hash(newPass, 10);
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
  const { db, session } = await getAuthenticatedDb();
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

  return { secret: secret.base32, uri: totp.toString() };
}

export async function verifyAndEnableTotp(secretBase32: string, token: string) {
  const { db, userId } = await getAuthenticatedDb();
  const { TOTP } = await import("otpauth");

  const totp = new TOTP({ secret: secretBase32 });
  const delta = totp.validate({ token, window: 1 });

  if (delta === null) {
    return { error: "INVALID_CODE" };
  }

  await db.update(users).set({
    twoFactorEnabled: true,
    twoFactorSecret: secretBase32,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}

export async function disableTotp() {
  const { db, userId } = await getAuthenticatedDb();
  await db.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
  }).where(eq(users.id, userId));

  revalidatePath("/settings");
  return { success: true };
}
