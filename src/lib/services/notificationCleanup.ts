/**
 * 古い通知の掃除。
 *
 * 通知は増える一方で、読み終わったものを残しても誰も見に来ない。
 * ただし未読を時間だけで消すと「見ていない通知が黙って消えた」になるため、
 * 既読を先に、未読はかなり長く置いてから消す。
 */
import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { notifications } from "@modparks/core/db/schema";
import { getDatabase } from "@/lib/db";
import type { Database } from "@/lib/db";

/** 既読の保持期間 */
const READ_RETENTION_DAYS = 90;

/** 未読の保持期間。読まれていないものを消すので長めに取る */
const UNREAD_RETENTION_DAYS = 180;

/** 1ユーザーが持てる通知の上限。超えた分は古い既読から削る */
const PER_USER_LIMIT = 2000;

/** 1回の実行で消す上限。D1 に長時間の削除を撃たせないための歯止め */
const MAX_DELETES_PER_RUN = 5000;

/** 1文の DELETE に載せる件数 */
const BATCH_SIZE = 500;

export type NotificationCleanupResult = {
  expiredRead: number;
  expiredUnread: number;
  overLimit: number;
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * 条件に合う通知をバッチで削除する。
 *
 * 一発の DELETE ではなく id を引いてから消すのは、削除件数を数えつつ
 * 1回の実行量を上限で抑えるため。
 *
 * @param budget この呼び出しで消してよい残り件数
 * @returns 実際に削除した件数
 */
async function deleteInBatches(db: Database, where: ReturnType<typeof and>, budget: number): Promise<number> {
  let deleted = 0;

  while (deleted < budget) {
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(where)
      .orderBy(asc(notifications.createdAt))
      .limit(Math.min(BATCH_SIZE, budget - deleted))
      .all();

    if (rows.length === 0) break;

    await db.delete(notifications).where(inArray(notifications.id, rows.map((r) => r.id))).run();
    deleted += rows.length;

    // 取れた件数が上限未満なら、条件に合うものは残っていない
    if (rows.length < BATCH_SIZE) break;
  }

  return deleted;
}

/**
 * 保持期間を過ぎた通知を消す。
 * @returns 既読・未読それぞれの削除件数
 */
async function deleteExpired(db: Database, budget: number) {
  const expiredRead = await deleteInBatches(
    db,
    and(eq(notifications.read, true), lt(notifications.createdAt, daysAgo(READ_RETENTION_DAYS))),
    budget,
  );

  const expiredUnread = await deleteInBatches(
    db,
    and(eq(notifications.read, false), lt(notifications.createdAt, daysAgo(UNREAD_RETENTION_DAYS))),
    budget - expiredRead,
  );

  return { expiredRead, expiredUnread };
}

/**
 * 上限を超えて溜め込んでいるユーザーの通知を、古い既読から削る。
 *
 * 保持期間内でも、通知が多いユーザーは際限なく増えるため。
 * 未読は残す（読まれていないものを件数都合で消さない）。
 */
async function trimOverLimitUsers(db: Database, budget: number): Promise<number> {
  if (budget <= 0) return 0;

  const heavyUsers = await db
    .select({ userId: notifications.userId, total: count() })
    .from(notifications)
    .groupBy(notifications.userId)
    .having(sql`count(*) > ${PER_USER_LIMIT}`)
    .orderBy(desc(count()))
    .all();

  let deleted = 0;

  for (const user of heavyUsers) {
    if (deleted >= budget) break;

    const excess = Math.min(user.total - PER_USER_LIMIT, budget - deleted);
    deleted += await deleteInBatches(
      db,
      and(eq(notifications.userId, user.userId), eq(notifications.read, true)),
      excess,
    );
  }

  return deleted;
}

/**
 * 古い通知の掃除を1回分実行する。
 *
 * 1回で消しきれなかった分は次回に持ち越す（日次で回る前提）。
 */
export async function cleanupOldNotifications(): Promise<NotificationCleanupResult> {
  const db = await getDatabase();

  const { expiredRead, expiredUnread } = await deleteExpired(db, MAX_DELETES_PER_RUN);
  const overLimit = await trimOverLimitUsers(db, MAX_DELETES_PER_RUN - expiredRead - expiredUnread);

  return { expiredRead, expiredUnread, overLimit };
}
