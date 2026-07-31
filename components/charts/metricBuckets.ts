/**
 * 日次データを日 / 週 / 月へまとめ直す。
 *
 * 粒度の切替でサーバーへ取りに行かなくて済むよう、
 * 1 年分の日次を 1 度だけ受け取ってクライアントで畳む。
 */

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** 粒度ごとの表示期間 (日数) */
const WINDOW_DAYS: Record<Granularity, number> = {
  day: 30,
  week: 84,
  month: 365,
};

export type DatedValues = {
  /** "YYYY-MM-DD" (UTC) */
  date: string;
  values: number[];
};

export type Bucket = {
  /** バケットの開始日 */
  date: Date;
  granularity: Granularity;
  values: number[];
};

/** 週は月曜始まり。日曜始まりだと週末の山が 2 週に割れて読みにくい */
function startOfWeek(at: Date): Date {
  const day = (at.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - day));
}

function bucketStart(at: Date, granularity: Granularity): Date {
  if (granularity === "week") return startOfWeek(at);
  if (granularity === "month") return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  return at;
}

/** 粒度に応じた表示期間ぶんだけ末尾から切り出す */
export function windowFor<T>(rows: T[], granularity: Granularity): T[] {
  return rows.slice(-WINDOW_DAYS[granularity]);
}

/** 日次の行を粒度でまとめる。値は系列ごとの合計 */
export function bucketize(rows: DatedValues[], granularity: Granularity): Bucket[] {
  const buckets = new Map<number, Bucket>();

  for (const row of windowFor(rows, granularity)) {
    const start = bucketStart(new Date(`${row.date}T00:00:00Z`), granularity);
    const key = start.getTime();
    const bucket = buckets.get(key) ?? { date: start, granularity, values: new Array(row.values.length).fill(0) };
    row.values.forEach((v, i) => { bucket.values[i] += v; });
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** 軸ラベル。月は年月、日と週は月日にする */
export function bucketLabel(bucket: Bucket, locale: string): string {
  if (bucket.granularity === "month") {
    return new Intl.DateTimeFormat(locale, { year: "2-digit", month: "short", timeZone: "UTC" }).format(bucket.date);
  }
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" }).format(bucket.date);
}

/** 系列ごとの合計。表示中の期間の順位付けに使う */
export function sumSeries(rows: DatedValues[], granularity: Granularity, seriesCount: number): number[] {
  const totals = new Array(seriesCount).fill(0);
  for (const row of windowFor(rows, granularity)) {
    row.values.forEach((v, i) => { totals[i] += v; });
  }
  return totals;
}
