/**
 * 管理画面のコスト概要が使う集計。
 *
 * usage_daily を唯一の入力とし、含有枠との突き合わせまでを行う。
 */
import { desc, gte } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { usageDaily, type UsageDaily } from "@/db/schema";
import { getAppSettings } from "@/lib/config/readSettings";
import {
  evaluateQuota,
  periodProgress,
  selectPeriodRows,
  toUsagePlan,
  worstLevel,
  type QuotaUsage,
  type UsageLevel,
  type UsagePlan,
} from "@/lib/usage/quota";
import { toEpochDay } from "@/lib/usage/rollup";

/** 推移グラフに出す日数 */
const HISTORY_DAYS = 30;

/** 含有枠の確認がこの日数を超えて古ければ、確認を促す */
export const QUOTA_RECHECK_DAYS = 90;

export type UsageOverview = {
  plan: UsagePlan;
  /** 期間内の消費と枠。リクエスト以外は枠が未設定なら評価されない */
  requests: QuotaUsage;
  /** 期間内のダウンロード数（計上の可否を問わない） */
  downloads: number;
  /** 実際に統計へ計上したダウンロード数 */
  downloadsCounted: number;
  /** Bot と判定されたリクエスト数 */
  botRequests: number;
  /** Bot と判定されたダウンロード数 */
  botDownloads: number;
  /** 期間の経過割合 */
  progress: number;
  level: UsageLevel;
  /** 日次の推移。古い順 */
  history: UsageDaily[];
  /** 含有枠と単価の確認が古い、または未確認か */
  quotaStale: boolean;
  /** 設定フォームの初期値 */
  settings: {
    usagePlan: UsagePlan;
    usageQuotaRequests: number;
    usageBudgetJpy: number;
  };
};

function sum(rows: UsageDaily[], pick: (row: UsageDaily) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

/**
 * コスト概要をまとめて取得する。
 *
 * 直近 30 日ぶんだけを読み、期間の切り出しは JS 側で行う。
 * 行数が高々 30 なので、プランごとに SQL を分けるより単純になる。
 */
export async function getUsageOverview(): Promise<UsageOverview> {
  const db = await getDatabase();
  const settings = await getAppSettings();
  const today = toEpochDay();

  const history = await db
    .select()
    .from(usageDaily)
    .where(gte(usageDaily.date, today - HISTORY_DAYS))
    .orderBy(desc(usageDaily.date))
    .all();

  const plan = toUsagePlan(settings.usagePlan);
  const periodRows = selectPeriodRows(history, plan, today);
  const progress = periodProgress(plan);

  const requests = evaluateQuota(
    sum(periodRows, (row) => row.requests),
    settings.usageQuotaRequests,
    plan,
    progress
  );

  return {
    plan,
    requests,
    downloads: sum(periodRows, (row) => row.downloads),
    downloadsCounted: sum(periodRows, (row) => row.downloadsCounted),
    botRequests: sum(periodRows, (row) => row.botRequests),
    botDownloads: sum(periodRows, (row) => row.botDownloads),
    progress,
    level: worstLevel([requests.level]),
    history: [...history].reverse(),
    quotaStale: settings.usageQuotaCheckedDay === 0
      || today - settings.usageQuotaCheckedDay > QUOTA_RECHECK_DAYS,
    settings: {
      usagePlan: plan,
      usageQuotaRequests: settings.usageQuotaRequests,
      usageBudgetJpy: settings.usageBudgetJpy,
    },
  };
}
