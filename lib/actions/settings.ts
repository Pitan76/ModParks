"use server";

import { getDb, getD1 } from "@/lib/db";
import { users, apiKeys, accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: { displayName: string, bio: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  await db.update(users).set({
    displayName: data.displayName,
    bio: data.bio
  }).where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
}

export async function generateApiKey(name: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  const keyStr = "mp_" + crypto.randomUUID().replace(/-/g, "");

  await db.insert(apiKeys).values({
    key: keyStr,
    name: name,
    userId: session.user.id,
  });

  revalidatePath("/settings");
  return { success: true, key: keyStr };
}

export async function deleteApiKey(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)));

  revalidatePath("/settings");
  return { success: true };
}

export async function disconnectGitHub() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  await db.delete(accounts).where(and(eq(accounts.userId, session.user.id), eq(accounts.provider, "github")));

  revalidatePath("/settings");
  return { success: true };
}

import { or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function changeUsername(newId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  // Validation: format check
  if (!/^[a-zA-Z0-9-_]+$/.test(newId)) {
    return { error: "errorIdFormat" };
  }

  const d1 = await getD1();
  const db = getDb(d1);

  // Check if taken
  const existing = await db.select().from(users).where(
    or(eq(users.username, newId), eq(users.previousUsername, newId))
  ).get();

  if (existing) {
    return { error: "errorIdTaken" };
  }

  const currentUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  
  await db.update(users).set({
    username: newId,
    previousUsername: currentUser?.username || null
  }).where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  return { success: true };
}

export async function changeEmail(newEmail: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  const existing = await db.select().from(users).where(eq(users.email, newEmail)).get();
  if (existing) {
    return { error: "errorEmailTaken" };
  }

  await db.update(users).set({ email: newEmail }).where(eq(users.id, session.user.id));
  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(oldPass: string, newPass: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  const user = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user?.passwordHash) return { error: "No password set" };

  const match = await bcrypt.compare(oldPass, user.passwordHash);
  if (!match) return { error: "errorWrongPassword" };

  const hashed = await bcrypt.hash(newPass, 10);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, session.user.id));

  return { success: true };
}

export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const d1 = await getD1();
  const db = getDb(d1);

  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, session.user.id));

  return { success: true };
}
