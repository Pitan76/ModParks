"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { notifications, projectSubscriptions, developerSubscriptions, userSettings } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications/types";

/** 指定した通知を既読にする */
export async function markNotificationsRead(ids: string[]) {
  const { db, userId } = await getAuthenticatedDb();
  if (ids.length === 0) return { success: true };

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
    .run();

  revalidatePath("/[locale]/notifications", "page");
  return { success: true };
}

/** すべての通知を既読にする */
export async function markAllNotificationsRead() {
  const { db, userId } = await getAuthenticatedDb();

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .run();

  revalidatePath("/[locale]/notifications", "page");
  return { success: true };
}

/** 通知種別ごとの受信ON/OFFを保存する */
export async function updateNotificationPrefs(prefs: Record<string, boolean>) {
  const { db, userId } = await getAuthenticatedDb();

  const sanitized: Record<string, boolean> = {};
  for (const type of NOTIFICATION_TYPES) sanitized[type] = prefs[type] !== false;

  await db
    .insert(userSettings)
    .values({ userId, notificationPrefs: sanitized })
    .onConflictDoUpdate({ target: userSettings.userId, set: { notificationPrefs: sanitized } })
    .run();

  revalidatePath("/[locale]/settings", "page");
  return { success: true };
}

/** プロジェクトの購読（ベル）をトグルする */
export async function toggleProjectSubscription(projectId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const existing = await db
    .select({ userId: projectSubscriptions.userId })
    .from(projectSubscriptions)
    .where(and(eq(projectSubscriptions.projectId, projectId), eq(projectSubscriptions.userId, userId)))
    .get();

  if (existing) {
    await db
      .delete(projectSubscriptions)
      .where(and(eq(projectSubscriptions.projectId, projectId), eq(projectSubscriptions.userId, userId)))
      .run();
    return { success: true, subscribed: false };
  }

  await db.insert(projectSubscriptions).values({ projectId, userId }).run();
  return { success: true, subscribed: true };
}

/** 開発者の新プロジェクト通知の購読（プロフィールのベル）をトグルする */
export async function toggleDeveloperSubscription(developerId: string) {
  const { db, userId } = await getAuthenticatedDb();
  if (developerId === userId) return { success: false, subscribed: false };

  const existing = await db
    .select({ subscriberId: developerSubscriptions.subscriberId })
    .from(developerSubscriptions)
    .where(and(eq(developerSubscriptions.developerId, developerId), eq(developerSubscriptions.subscriberId, userId)))
    .get();

  if (existing) {
    await db
      .delete(developerSubscriptions)
      .where(and(eq(developerSubscriptions.developerId, developerId), eq(developerSubscriptions.subscriberId, userId)))
      .run();
    return { success: true, subscribed: false };
  }

  await db.insert(developerSubscriptions).values({ developerId, subscriberId: userId }).run();
  return { success: true, subscribed: true };
}

export type { NotificationType };
