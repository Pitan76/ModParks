"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { users, settingsAudit, backupAudit } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";

export async function updateUserRole(targetUserId: string, newRole: "user" | "admin") {
  const { db, session } = await getAdminDb();

  // Prevents self-demotion to avoid locking out the only admin
  if (targetUserId === session.user.id && newRole === "user") {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  await recordModerationAudit(db, "role_change", targetUserId, session.user.id, { newRole });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUsernameByAdmin(targetUserId: string, newUsername: string) {
  const { db } = await getAdminDb();
  const { userProfiles, userSettings, users } = await import("@/db/schema");
  
  if (!newUsername || !/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
    throw new Error("Invalid username format. Use alphanumeric characters, hyphens, and underscores.");
  }

  const existing = await db.select().from(userProfiles).where(eq(userProfiles.username, newUsername)).get();
  if (existing && existing.userId !== targetUserId) {
    throw new Error("Username already taken by another user.");
  }

  const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).get();
  
  if (targetProfile) {
    await db.update(userProfiles).set({ username: newUsername }).where(eq(userProfiles.userId, targetUserId));
  } else {
    const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
    if (!user) throw new Error("User not found");
    
    await db.insert(userProfiles).values({
      userId: targetUserId,
      username: newUsername,
      displayName: user.name || "Unknown",
      avatarUrl: user.image,
    });
    
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, targetUserId)).get();
    if (!settings) {
      await db.insert(userSettings).values({ userId: targetUserId });
    }
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();
  const { userProfiles } = await import("@/db/schema");

  if (targetUserId === session.user.id) {
    throw new Error("Cannot delete yourself");
  }

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const timestamp = Date.now();
  const scrambledEmail = user.email ? `deleted_${timestamp}_${user.email}` : null;
  const scrambledGithubId = user.githubId ? `deleted_${timestamp}_${user.githubId}` : null;

  // Soft delete by setting deletedAt and scrambling unique fields so they can be reused
  await db.update(users).set({ 
    deletedAt: new Date(),
    email: scrambledEmail,
    githubId: scrambledGithubId
  }).where(eq(users.id, targetUserId));

  // Scramble username as well to free it up
  const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).get();
  if (profile) {
    await db.update(userProfiles).set({
      username: `deleted_${timestamp}_${profile.username}`
    }).where(eq(userProfiles.userId, targetUserId));
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function purgeDeletedUsers() {
  const { db } = await getAdminDb();
  const { isNotNull } = await import("drizzle-orm");

  // 墓標を残すため、削除前に対象の id を控えておく
  const targets = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.deletedAt))
    .all();

  // Hard delete all users where deletedAt is not null
  await db.delete(users).where(isNotNull(users.deletedAt));

  await recordDeletion(db, "users", targets.map((u: { id: string }) => u.id));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function hardDeleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) {
    throw new Error("Cannot delete yourself");
  }

  // Hard delete the specific user
  await db.delete(users).where(eq(users.id, targetUserId));

  await recordDeletion(db, "users", targetUserId);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function adminDeleteProject(projectId: string) {
  const { db } = await getAdminDb();
  const { projects } = await import("@/db/schema");
  
  await db.delete(projects).where(eq(projects.id, projectId));
  await recordDeletion(db, "projects", projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  return { success: true };
}

export async function adminDeleteIdea(ideaId: string) {
  const { db } = await getAdminDb();
  const { ideas } = await import("@/db/schema");
  
  await db.delete(ideas).where(eq(ideas.id, ideaId));
  await recordDeletion(db, "ideas", ideaId);

  revalidatePath("/admin/ideas");
  revalidatePath("/ideas");
  return { success: true };
}

export async function getSettingsAudits(limit = 50, offset = 0) {
  const { db } = await getAdminDb();
  
  const logs = await db
    .select()
    .from(settingsAudit)
    .orderBy(desc(settingsAudit.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(settingsAudit)
    .get();

  return { logs, total: countRes?.count ?? 0 };
}

export async function getBackupAudits(limit = 50, offset = 0) {
  const { db } = await getAdminDb();

  const logs = await db
    .select()
    .from(backupAudit)
    .orderBy(desc(backupAudit.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(backupAudit)
    .get();

  return { logs, total: countRes?.count ?? 0 };
}
