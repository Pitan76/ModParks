/**
 * ダッシュボードのグラフ用集計。
 *
 * 累積カウンタ (projects.downloads) は期間差分が取れないため、
 * 日次の実測値を持つ project_metric_daily を唯一の入力にする。
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { posts, projectMetricDaily, pointTransactions } from "@/db/schema";

const SECONDS_PER_DAY = 86_400;

export type DailyMetricPoint = {
  /** "YYYY-MM-DD" (UTC) */
  date: string;
  downloads: number;
  views: number;
};

export type MonthlyRewardPoint = {
  /** "YYYY-MM" */
  period: string;
  earned: number;
  spent: number;
};

/** UTC 基準の epoch day を ISO 日付へ戻す */
function fromEpochDay(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

function toEpochDay(at: Date): number {
  return Math.floor(at.getTime() / (SECONDS_PER_DAY * 1000));
}

/**
 * 欠測日を 0 で埋めて連続させる。
 * 抜けた日を線でつなぐと実際より緩やかな推移に見えるため。
 */
function fillMissingDays(
  rows: Map<number, { downloads: number; views: number }>,
  fromDay: number,
  days: number
): DailyMetricPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const day = fromDay + i;
    const row = rows.get(day);
    return {
      date: fromEpochDay(day),
      downloads: row?.downloads ?? 0,
      views: row?.views ?? 0,
    };
  });
}

/** 自分のプロジェクト全体の日次ダウンロード / 閲覧推移 */
export async function getDownloadTrend(userId: string, days = 30): Promise<DailyMetricPoint[]> {
  const db = await getDatabase();
  const fromDay = toEpochDay(new Date()) - (days - 1);

  const rows = await db
    .select({
      date: projectMetricDaily.date,
      downloads: sql<number>`sum(${projectMetricDaily.downloads})`,
      views: sql<number>`sum(${projectMetricDaily.pageViews})`,
    })
    .from(projectMetricDaily)
    .innerJoin(posts, eq(posts.id, projectMetricDaily.projectId))
    .where(and(eq(posts.authorId, userId), gte(projectMetricDaily.date, fromDay)))
    .groupBy(projectMetricDaily.date)
    .all();

  const byDay = new Map(rows.map((r) => [r.date, { downloads: r.downloads, views: r.views }]));
  return fillMissingDays(byDay, fromDay, days);
}

export type ProjectSeries = {
  /** 積み上げの系列 (上位プロジェクト + その他) */
  names: string[];
  /** names と同じ並びの日次カウント */
  rows: { date: string; counts: number[] }[];
};

/**
 * プロジェクト別の日次ダウンロード。
 * 系列が増えすぎると色で識別できなくなるため、上位 topN 以外は「その他」へまとめる。
 */
export async function getProjectDownloadSeries(
  userId: string,
  days = 365,
  topN = 5,
  otherLabel = "Other"
): Promise<ProjectSeries> {
  const db = await getDatabase();
  const fromDay = toEpochDay(new Date()) - (days - 1);

  const rows = await db
    .select({
      date: projectMetricDaily.date,
      title: posts.title,
      downloads: sql<number>`sum(${projectMetricDaily.downloads})`,
    })
    .from(projectMetricDaily)
    .innerJoin(posts, eq(posts.id, projectMetricDaily.projectId))
    .where(and(eq(posts.authorId, userId), gte(projectMetricDaily.date, fromDay)))
    .groupBy(projectMetricDaily.date, posts.id)
    .all();

  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.title, (totals.get(row.title) ?? 0) + row.downloads);

  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([title]) => title);

  const hasOther = totals.size > top.length;
  const names = hasOther ? [...top, otherLabel] : top;
  const indexOf = new Map(names.map((name, i) => [name, i]));

  const byDate = new Map<number, number[]>();
  for (const row of rows) {
    const counts = byDate.get(row.date) ?? new Array(names.length).fill(0);
    const index = indexOf.get(row.title) ?? names.length - 1;
    counts[index] += row.downloads;
    byDate.set(row.date, counts);
  }

  return {
    names,
    rows: Array.from({ length: days }, (_, i) => {
      const day = fromDay + i;
      return { date: fromEpochDay(day), counts: byDate.get(day) ?? new Array(names.length).fill(0) };
    }),
  };
}

/** 月次のポイント獲得 / 消費。台帳が唯一の真実なので残高キャッシュは使わない */
export async function getRewardTrend(userId: string, months = 6): Promise<MonthlyRewardPoint[]> {
  const db = await getDatabase();
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
  from.setUTCHours(0, 0, 0, 0);

  const period = sql<string>`strftime('%Y-%m', ${pointTransactions.createdAt}, 'unixepoch')`;

  const rows = await db
    .select({
      period,
      earned: sql<number>`sum(max(${pointTransactions.amount}, 0))`,
      spent: sql<number>`sum(-min(${pointTransactions.amount}, 0))`,
    })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.userId, userId), gte(pointTransactions.createdAt, from)))
    .groupBy(period)
    .all();

  const byPeriod = new Map(rows.map((r) => [r.period, r]));

  return Array.from({ length: months }, (_, i) => {
    const at = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const key = at.toISOString().slice(0, 7);
    const row = byPeriod.get(key);
    return { period: key, earned: row?.earned ?? 0, spent: row?.spent ?? 0 };
  });
}
