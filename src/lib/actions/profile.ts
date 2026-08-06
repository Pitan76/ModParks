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

export async function getFollowList(targetUsername: string, type: "followers" | "following") {
  const { getDb, getD1 } = await import("@/lib/db");
  const { users, userProfiles, userFollows } = await import("@/db/schema");
  const { eq, and, isNull } = await import("drizzle-orm");

  const d1 = await getD1();
  const db = getDb(d1);

  const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.username, targetUsername)).get();
  if (!targetProfile) throw new Error("User not found");

  if (type === "followers") {
    // Users who follow target
    return await db.select({
      id: users.id,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.id))
      .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(eq(userFollows.followingId, targetProfile.userId), isNull(users.deletedAt)))
      .all();
  } else {
    // Users who target follows
    return await db.select({
      id: users.id,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followingId, users.id))
      .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(eq(userFollows.followerId, targetProfile.userId), isNull(users.deletedAt)))
      .all();
  }
}
