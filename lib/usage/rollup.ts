/**
 * 利用量の日次ロールアップ。
 *
 * 新しい計測基盤は建てず、既に収集している ddos_slices と
 * version_download_daily を日次へ畳んで usage_daily に持つ。
 */
import { and, gte, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { ddosSlices, usageDaily, versionDownloadDaily } from "@/db/schema";
import { fetchDailyRequests, type DayRequests } from "@/lib/usage/analytics";

type Db = Awaited<ReturnType<typeof getDatabase>>;

const SECONDS_PER_DAY = 86_400;

/** UTC 基準の epoch day */
export function toEpochDay(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 86_400_000);
}

type SliceTotals = {
  requests: number;
  downloads: number;
  botRequests: number;
  botDownloads: number;
};

/**
 * その日のスライスを合計する。
 * ddos_slices は保持期間が短いため、過去日を遡って再計算することはできない。
 */
async function sumSlices(db: Db, date: number): Promise<SliceTotals> {
  const from = date * SECONDS_PER_DAY;
  const row = await db
    .select({
      requests:     sql<number>`coalesce(sum(${ddosSlices.requestCount}), 0)`,
      downloads:    sql<number>`coalesce(sum(${ddosSlices.downloadCount}), 0)`,
      botRequests:  sql<number>`coalesce(sum(${ddosSlices.botCount}), 0)`,
      botDownloads: sql<number>`coalesce(sum(${ddosSlices.botDownloadCount}), 0)`,
    })
    .from(ddosSlices)
    .where(and(gte(ddosSlices.sliceTime, from), lt(ddosSlices.sliceTime, from + SECONDS_PER_DAY)))
    .get();

  return row ?? { requests: 0, downloads: 0, botRequests: 0, botDownloads: 0 };
}

/** その日に実際へ計上したダウンロード数 */
async function sumCountedDownloads(db: Db, date: number): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${versionDownloadDaily.count}), 0)` })
    .from(versionDownloadDaily)
    .where(sql`${versionDownloadDaily.date} = ${date}`)
    .get();

  return row?.total ?? 0;
}

/** epoch day を UTC の ISO 日付へ */
export function toIsoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 指定日の利用量サマリを作り直す。
 *
 * 合計を入れ直すだけなので、同じ日に何度実行しても結果は変わらない。
 *
 * @param measured Cloudflare の実測値。undefined なら既存の値を保つ
 *   （取得に失敗しただけで、取得済みの値を消さないため）
 */
export async function rollupUsageForDay(date: number, measured?: DayRequests): Promise<void> {
  const db = await getDatabase();
  const slices = await sumSlices(db, date);
  const downloadsCounted = await sumCountedDownloads(db, date);

  const values = {
    date,
    requests: slices.requests,
    downloads: slices.downloads,
    botRequests: slices.botRequests,
    botDownloads: slices.botDownloads,
    downloadsCounted,
    updatedAt: Date.now(),
  };

  const cf = measured
    ? { cfRequests: measured.total, cfRequestsOwn: measured.own }
    : { cfRequests: null, cfRequestsOwn: null };

  await db
    .insert(usageDaily)
    .values({ ...values, ...cf })
    .onConflictDoUpdate({
      target: usageDaily.date,
      set: measured ? { ...values, ...cf } : values,
    })
    .run();
}

/**
 * 当日と前日をロールアップする。
 *
 * 前日も対象にするのは、日付境界をまたいだ直後の実行で
 * 前日の最後のスライスを取りこぼさないため。
 */
export async function rollupRecentUsage(): Promise<void> {
  const today = toEpochDay();
  const yesterday = today - 1;

  // 2日ぶんをまとめて取り、外部 API の呼び出しを 1 回に抑える
  const measured = await fetchDailyRequests(toIsoDate(yesterday), toIsoDate(today));

  await rollupUsageForDay(today, measured?.get(toIsoDate(today)));
  await rollupUsageForDay(yesterday, measured?.get(toIsoDate(yesterday)));
}
