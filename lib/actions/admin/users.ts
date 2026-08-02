"use server";

import { eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/auth-helpers";
import { users, userProfiles, userSettings } from "@/db/schema";
import { recordDeletion } from "@/lib/backup/tombstone";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";

/** プレミアム付与で受け付ける最大日数（約10年） */
const MAX_PREMIUM_DAYS = 3650;

/** ユーザーの権限を変更する。唯一の管理者が締め出されるのを防ぐため自己降格は拒否する */
export async function updateUserRole(targetUserId: string, newRole: "user" | "admin") {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id && newRole === "user") {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  await recordModerationAudit(db, "role_change", targetUserId, session.user.id, { newRole });

  revalidatePath("/admin/users");
  return { success: true };
}

/** ユーザーの凍結状態を反転する */
export async function toggleUserSuspension(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) throw new Error("Cannot suspend yourself");

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const newSuspendedAt = user.suspendedAt ? null : new Date();

  await db.update(users).set({ suspendedAt: newSuspendedAt }).where(eq(users.id, targetUserId));
  await recordModerationAudit(db, newSuspendedAt ? "suspend_user" : "unsuspend_user", targetUserId, session.user.id);

  revalidatePath("/admin/users");
  return { success: true, suspended: !!newSuspendedAt };
}

/**
 * プレミアムを手動で付与する。販売は未実施のため、付与経路は当面この管理操作のみ。
 * @param days 有効日数。未指定（null）なら無期限
 */
export async function grantPremium(targetUserId: string, days: number | null = null) {
  const { db, session } = await getAdminDb();

  if (days !== null && (!Number.isFinite(days) || days <= 0 || days > MAX_PREMIUM_DAYS)) {
    throw new Error("Invalid premium duration");
  }

  const user = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const premiumUntil = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.update(users)
    .set({ premiumTier: "premium", premiumUntil })
    .where(eq(users.id, targetUserId));

  await recordModerationAudit(db, "premium_grant", targetUserId, session.user.id, {
    days,
    until: premiumUntil?.toISOString() ?? null,
  });

  revalidatePath("/admin/users");
  return { success: true, premiumUntil: premiumUntil ? premiumUntil.getTime() : null };
}

/** プレミアムを取り消す */
export async function revokePremium(targetUserId: string) {
  const { db, session } = await getAdminDb();

  await db.update(users)
    .set({ premiumTier: "free", premiumUntil: null })
    .where(eq(users.id, targetUserId));

  await recordModerationAudit(db, "premium_revoke", targetUserId, session.user.id);

  revalidatePath("/admin/users");
  return { success: true };
}

/** 管理者がユーザーIDを変更する。プロフィール未作成のユーザーにはここで作成する */
export async function updateUsernameByAdmin(targetUserId: string, newUsername: string) {
  const { db } = await getAdminDb();

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
    revalidatePath("/admin/users");
    return { success: true };
  }

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  await db.insert(userProfiles).values({
    userId: targetUserId,
    username: newUsername,
    displayName: user.name || "Unknown",
    avatarUrl: user.image,
  });

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, targetUserId)).get();
  if (!settings) await db.insert(userSettings).values({ userId: targetUserId });

  revalidatePath("/admin/users");
  return { success: true };
}

/** 論理削除する。email / githubId / username は再利用できるよう退避名に置き換える */
export async function deleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) throw new Error("Cannot delete yourself");

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const timestamp = Date.now();

  await db.update(users).set({
    deletedAt: new Date(),
    email:    user.email ? `deleted_${timestamp}_${user.email}` : null,
    githubId: user.githubId ? `deleted_${timestamp}_${user.githubId}` : null,
  }).where(eq(users.id, targetUserId));

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).get();
  if (profile) {
    await db.update(userProfiles)
      .set({ username: `deleted_${timestamp}_${profile.username}` })
      .where(eq(userProfiles.userId, targetUserId));
  }

  revalidatePath("/admin/users");
  return { success: true };
}

/** 論理削除済みのユーザーをまとめて物理削除する */
export async function purgeDeletedUsers() {
  const { db } = await getAdminDb();

  // 墓標を残すため、削除前に対象の id を控えておく
  const targets = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.deletedAt))
    .all();

  await db.delete(users).where(isNotNull(users.deletedAt));
  await recordDeletion(db, "users", targets.map((u: { id: string }) => u.id));

  revalidatePath("/admin/users");
  return { success: true };
}

/** 指定ユーザーを物理削除する */
export async function hardDeleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) throw new Error("Cannot delete yourself");

  await db.delete(users).where(eq(users.id, targetUserId));
  await recordDeletion(db, "users", targetUserId);

  revalidatePath("/admin/users");
  return { success: true };
}
