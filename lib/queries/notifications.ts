import { getDatabase } from "@/lib/db";
import { notifications, users, userProfiles } from "@/db/schema";
import { eq, and, or, desc, count, inArray } from "drizzle-orm";
import type { Notification } from "@/db/schema";

/** ベルのドロップダウン等で使う最近の通知一覧 */
export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();

  return withActorAvatars(db, rows);
}

/**
 * 通知の payload に、操作者の「現在の」アバター URL を埋める。
 *
 * payload に焼き込まれた actorImage をそのまま使わないのは、
 * (1) actorId を載せる前の古い通知には actorImage が無い
 * (2) 本人がアバターを変えた後も古い URL を表示し続けてしまう
 * ため。actorId → actorUsername → actorName(表示名) の順に引き当て、
 * どれも当たらなければ payload の値にフォールバックする
 * （最終的に表示側で頭文字アバターになる）。
 */
async function withActorAvatars(db: any, rows: Notification[]): Promise<Notification[]> {
  const ids = new Set<string>();
  const usernames = new Set<string>();
  const displayNames = new Set<string>();
  for (const row of rows) {
    const p = (row.payload ?? {}) as Record<string, string>;
    if (p.actorId) ids.add(p.actorId);
    else if (p.actorUsername) usernames.add(p.actorUsername);
    // actorId/actorUsername を載せる前の古い通知は表示名しか手掛かりがない
    else if (p.actorName) displayNames.add(p.actorName);
  }
  if (ids.size === 0 && usernames.size === 0 && displayNames.size === 0) return rows;

  const conditions = [
    ids.size > 0 ? inArray(userProfiles.userId, [...ids]) : undefined,
    usernames.size > 0 ? inArray(userProfiles.username, [...usernames]) : undefined,
    displayNames.size > 0 ? inArray(userProfiles.displayName, [...displayNames]) : undefined,
  ].filter(Boolean);

  const profileRows = (await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      image: users.image,
    })
    .from(userProfiles)
    .leftJoin(users, eq(users.id, userProfiles.userId))
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .all()) as {
    userId: string; username: string; displayName: string | null;
    avatarUrl: string | null; image: string | null;
  }[];

  const imageById = new Map<string, string>();
  const imageByUsername = new Map<string, string>();
  const imageByDisplayName = new Map<string, string>();
  // 表示名は一意ではないため、重複した名前は特定できないものとして捨てる
  const ambiguousNames = new Set<string>();

  for (const p of profileRows) {
    const image = p.avatarUrl || p.image;
    if (!image) continue;
    imageById.set(p.userId, image);
    imageByUsername.set(p.username, image);
    if (!p.displayName) continue;
    if (imageByDisplayName.has(p.displayName)) ambiguousNames.add(p.displayName);
    imageByDisplayName.set(p.displayName, image);
  }
  for (const name of ambiguousNames) imageByDisplayName.delete(name);

  return rows.map((row) => {
    const p = (row.payload ?? {}) as Record<string, string>;
    const image =
      (p.actorId ? imageById.get(p.actorId) : undefined) ??
      (p.actorUsername ? imageByUsername.get(p.actorUsername) : undefined) ??
      (p.actorName ? imageByDisplayName.get(p.actorName) : undefined) ??
      p.actorImage;
    if (!image) return row;
    return { ...row, payload: { ...p, actorImage: image } };
  });
}

/** 未読件数（ベルのドット表示判定に使用） */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .get();
  return row?.value ?? 0;
}
