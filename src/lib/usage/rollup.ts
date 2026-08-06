/**
 * 利用量サマリのうち、いつでも取り直せる値を更新する。
 *
 * スライス由来の値（リクエスト数・Bot 数など）はここでは扱わない。
 * ddos_slices は 30 分で削除されるため合計を取り直せず、
 * 別経路で増分を積んでいる（lib/usage/sliceRollup.ts）。
 */
import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { usageDaily, versionDownloadDaily } from "@/db/schema";
import { fetchDailyRequests, type DayRequests } from "@/lib/usage/analytics";
import { writeAnalyticsStatus } from "@/lib/usage/analyticsStatus";

type Db = Awaited<ReturnType<typeof getDatabase>>;

/** UTC 基準の epoch day */
export function toEpochDay(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 86_400_000);
}

/** epoch day を UTC の ISO 日付へ */
export function toIsoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** その日に実際へ計上したダウンロード数。永続テーブルなので何度でも取り直せる */
async function sumCountedDownloads(db: Db, date: number): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${versionDownloadDaily.count}), 0)` })
    .from(versionDownloadDaily)
    .where(sql`${versionDownloadDaily.date} = ${date}`)
    .get();

  return row?.total ?? 0;
}

/**
 * 取り直せる値だけを入れ直す。
 *
 * @param measured Cloudflare の実測値。undefined なら既存の値を保つ
 *   （取得に失敗しただけで、取得済みの値を消さないため）
 */
export async function refreshUsageForDay(date: number, measured?: DayRequests): Promise<void> {
  const db = await getDatabase();
  const downloadsCounted = await sumCountedDownloads(db, date);

  const cf = measured
    ? { cfRequests: measured.total, cfRequestsOwn: measured.own }
    : {};

  const values = { downloadsCounted, updatedAt: Date.now(), ...cf };

  await db
    .insert(usageDaily)
    .values({ date, ...values })
    .onConflictDoUpdate({ target: usageDaily.date, set: values })
    .run();
}

/**
 * 当日と前日の取り直せる値を更新する。
 *
 * 前日も対象にするのは、日付境界をまたいだ直後の実行で
 * 前日ぶんの実測値が確定していないことがあるため。
 */
export async function rollupRecentUsage(): Promise<void> {
  const today = toEpochDay();
  const yesterday = today - 1;

  // 2日ぶんをまとめて取り、外部 API の呼び出しを 1 回に抑える
  const result = await fetchDailyRequests(toIsoDate(yesterday), toIsoDate(today));
  await writeAnalyticsStatus(result.ok ? undefined : result.failure);

  const measured = result.ok ? result.data : null;
  await refreshUsageForDay(today, measured?.get(toIsoDate(today)));
  await refreshUsageForDay(yesterday, measured?.get(toIsoDate(yesterday)));
}
