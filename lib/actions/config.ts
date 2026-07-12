"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { tags, platforms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateTags() {
  revalidatePath("/admin/config");
  revalidateTag("master:tags");
}

function revalidatePlatforms() {
  revalidatePath("/admin/config");
  revalidateTag("master:platforms");
}

export async function createTag(name: string, slug: string, description?: string) {
  const { db } = await getAdminDb();
  await db.insert(tags).values({ name, slug, description });
  revalidateTags();
  return { success: true };
}

export async function updateTag(id: string, name: string, slug: string, description?: string) {
  const { db } = await getAdminDb();
  await db.update(tags).set({ name, slug, description }).where(eq(tags.id, id));
  revalidateTags();
  return { success: true };
}

export async function deleteTag(id: string) {
  const { db } = await getAdminDb();
  await db.delete(tags).where(eq(tags.id, id));
  revalidateTags();
  return { success: true };
}

export async function createPlatform(name: string, slug: string, iconUrl?: string) {
  const { db } = await getAdminDb();
  await db.insert(platforms).values({ name, slug, iconUrl });
  revalidatePlatforms();
  return { success: true };
}

export async function updatePlatform(id: string, name: string, slug: string, iconUrl?: string) {
  const { db } = await getAdminDb();
  await db.update(platforms).set({ name, slug, iconUrl }).where(eq(platforms.id, id));
  revalidatePlatforms();
  return { success: true };
}

export async function deletePlatform(id: string) {
  const { db } = await getAdminDb();
  await db.delete(platforms).where(eq(platforms.id, id));
  revalidatePlatforms();
  return { success: true };
}
