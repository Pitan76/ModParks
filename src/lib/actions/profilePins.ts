"use server";

import { auth } from "@/lib/auth";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { profilePins, userSettings, userProfiles } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { MAX_PINS, type PinItemType, type PinRef } from "@/lib/pins";

/** 現在のログインユーザーのピン留め一覧（表示順）を返す。未ログインなら空配列。 */
export async function getMyPins(): Promise<PinRef[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const db = await getDatabase();
  const rows = await db
    .select({ itemType: profilePins.itemType, itemId: profilePins.itemId })
    .from(profilePins)
    .where(eq(profilePins.userId, session.user.id))
    .orderBy(profilePins.sortOrder)
    .all();

  return rows as PinRef[];
}

/**
 * ピン留めのトグル。既にピン留め済みなら解除、未ピンなら追加する。
 * 追加時に上限（MAX_PINS）を超える場合は追加せず error: "limit" を返す。
 */
export async function togglePin(
  itemType: PinItemType,
  itemId: string
): Promise<{ pinned: boolean } | { error: "limit" }> {
  const { db, userId } = await getAuthenticatedDb();

  const existing = await db
    .select()
    .from(profilePins)
    .where(
      and(
        eq(profilePins.userId, userId),
        eq(profilePins.itemType, itemType),
        eq(profilePins.itemId, itemId)
      )
    )
    .get();

  if (existing) {
    await db
      .delete(profilePins)
      .where(
        and(
          eq(profilePins.userId, userId),
          eq(profilePins.itemType, itemType),
          eq(profilePins.itemId, itemId)
        )
      );
    await recordDeletion(db, "profile_pins", `${userId}:${itemType}:${itemId}`);
    await revalidateProfile(db, userId);
    return { pinned: false };
  }

  const countRow = await db
    .select({ count: sql<number>`count(*)`, maxOrder: sql<number>`coalesce(max(${profilePins.sortOrder}), -1)` })
    .from(profilePins)
    .where(eq(profilePins.userId, userId))
    .get();

  if ((countRow?.count ?? 0) >= MAX_PINS) {
    return { error: "limit" };
  }

  await db.insert(profilePins).values({
    userId,
    itemType,
    itemId,
    sortOrder: (countRow?.maxOrder ?? -1) + 1,
  });

  await revalidateProfile(db, userId);
  return { pinned: true };
}

/** プロフィール上での投稿アイデア表示 ON/OFF を切り替える。 */
export async function setShowIdeasOnProfile(show: boolean): Promise<{ success: true }> {
  const { db, userId } = await getAuthenticatedDb();

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  const customObj = ((settings?.custom as Record<string, any>) || {});
  customObj.showIdeasOnProfile = show;

  await db.update(userSettings).set({ custom: customObj }).where(eq(userSettings.userId, userId));

  await revalidateProfile(db, userId);
  return { success: true };
}

async function revalidateProfile(db: Awaited<ReturnType<typeof getDatabase>>, userId: string) {
  const profile = await db
    .select({ username: userProfiles.username })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();
  revalidatePath("/[locale]/profile/[username]", "page");
  if (profile?.username) {
    revalidatePath(`/ja/profile/${profile.username}`);
    revalidatePath(`/en/profile/${profile.username}`);
  }
}
