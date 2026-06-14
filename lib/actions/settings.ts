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
