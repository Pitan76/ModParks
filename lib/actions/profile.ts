"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;
  const avatarUrl = formData.get("avatarUrl") as string;

  if (!displayName) {
    return { error: "displayNameRequired" };
  }

  await db
    .update(userProfiles)
    .set({
      displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
    })
    .where(eq(userProfiles.userId, userId))
    .run();
    
  await db.update(users).set({ name: displayName }).where(eq(users.id, userId)).run();

  revalidatePath("/profile");
  return { success: true };
}
