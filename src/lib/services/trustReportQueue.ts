/**
 * 審査キューが放置されないようにする通知。
 *
 * 通報だけではコンテンツは非表示にならないため、速さは自動化ではなく通知で担保する。
 * ただし個別の再通知を繰り返すと通知疲れで全部無視されるようになるので、
 * しつこくするのではなく形を変えて合流させる:
 *
 *   1. 即時         … 通報が入った時点（通報側のロジックで送る）
 *   2. 24 時間後に 1 回 … まだ未処理なら再通知
 *   3. 以降は日次サマリ … 個別には鳴らさず「未処理 N 件」としてまとめる
 */
import { and, count, eq, lt } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { reports } from "@/db/schema";
import { buildReportQueueEmbed, sendTrustAlert } from "./trustAlert";

const HOUR_MS = 3_600_000;

/** 再通知を出すまでの猶予 */
export const REPORT_REMINDER_HOURS = 24;

/** 未処理の通報件数。滞留している分だけを数える */
async function countPendingReports(before: Date): Promise<number> {
  const db = await getDatabase();
  const row = await db
    .select({ total: count() })
    .from(reports)
    .where(and(eq(reports.status, "pending"), lt(reports.createdAt, before)))
    .get();

  return Number(row?.total ?? 0);
}

/**
 * 滞留している通報を管理者へ知らせる。
 *
 * 日次で呼ぶ想定なので、24 時間より新しい通報は対象にしない
 * （入った直後の通報は即時通知の担当）。
 * @returns 通知した件数。滞留がなければ 0
 */
export async function notifyStalledReports(webhookUrl: string | undefined, now = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() - REPORT_REMINDER_HOURS * HOUR_MS);
  const pending = await countPendingReports(threshold);
  if (pending === 0) return 0;

  await sendTrustAlert(webhookUrl, buildReportQueueEmbed({ pending, reminder: true }));
  return pending;
}
