import { getDatabase } from "@/lib/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import type { Notification } from "@/db/schema";

/** ベルのドロップダウン等で使う最近の通知一覧 */
export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
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
