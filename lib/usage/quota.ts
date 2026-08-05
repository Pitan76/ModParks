/**
 * 含有枠に対する消費率の算出。
 *
 * 金額ではなく消費率で持つことで、単価が改定されても閾値を直さずに済む。
 * free と paid は超過時の結果が正反対（停止 / 課金）なので、判定期間も変える。
 */
import type { UsageDaily } from "@/db/schema";

/** free は日次リセット、paid は月次リセット */
export type UsagePlan = "free" | "paid";

/** 設定値をプランへ落とす。想定外の値は停止側に厳しい free として扱う */
export function toUsagePlan(value: string): UsagePlan {
  return value === "paid" ? "paid" : "free";
}

/** 消費の深刻度。free と paid で境界が違う */
export type UsageLevel = "normal" | "notice" | "warning" | "critical";

/** free で「もう手を打たないと間に合わない」水準 */
const FREE_WARNING_RATIO = 0.6;
const FREE_CRITICAL_RATIO = 0.8;

/** paid は超過してはじめて課金なので、境界を後ろに置ける */
const PAID_WARNING_RATIO = 0.8;
const PAID_CRITICAL_RATIO = 1.0;

/** 想定ペースに対してこの倍率を超えたら Notice */
const PACE_NOTICE_MULTIPLIER = 1.5;

export type QuotaUsage = {
  /** 期間内の累計 */
  used: number;
  /** 含有枠。0 なら未設定 */
  quota: number;
  /** 消費率。枠が未設定なら null */
  ratio: number | null;
  /** 期間の経過割合に対する超過倍率。枠が未設定なら null */
  paceMultiplier: number | null;
  level: UsageLevel;
};

/** 日次(free) / 月次(paid) の集計対象を切り出す */
export function selectPeriodRows(rows: UsageDaily[], plan: UsagePlan, today: number): UsageDaily[] {
  if (plan === "free") return rows.filter((row) => row.date === today);

  const firstDayOfMonth = toEpochDayOfMonthStart(today);
  return rows.filter((row) => row.date >= firstDayOfMonth);
}

/** epoch day から、その月の初日の epoch day を求める */
function toEpochDayOfMonthStart(day: number): number {
  const date = new Date(day * 86_400_000);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 86_400_000);
}

/**
 * 期間の経過割合。
 * free は日内の経過、paid は月内の経過を返す。
 */
export function periodProgress(plan: UsagePlan, now: Date = new Date()): number {
  if (plan === "free") {
    const msIntoDay = now.getTime() % 86_400_000;
    return msIntoDay / 86_400_000;
  }

  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return (now.getUTCDate() - 1 + now.getUTCHours() / 24) / daysInMonth;
}

function resolveLevel(plan: UsagePlan, ratio: number, pace: number | null): UsageLevel {
  const warning = plan === "free" ? FREE_WARNING_RATIO : PAID_WARNING_RATIO;
  const critical = plan === "free" ? FREE_CRITICAL_RATIO : PAID_CRITICAL_RATIO;

  if (ratio >= critical) return "critical";
  if (ratio >= warning) return "warning";
  if (pace !== null && pace >= PACE_NOTICE_MULTIPLIER) return "notice";

  return "normal";
}

/**
 * 消費量を含有枠と突き合わせる。
 *
 * @param quota 0 なら未設定として評価しない
 * @param progress 期間の経過割合。0 のときはペース判定を行わない
 */
export function evaluateQuota(
  used: number,
  quota: number,
  plan: UsagePlan,
  progress: number
): QuotaUsage {
  if (quota <= 0) {
    return { used, quota, ratio: null, paceMultiplier: null, level: "normal" };
  }

  const ratio = used / quota;
  const paceMultiplier = progress > 0 ? ratio / progress : null;

  return { used, quota, ratio, paceMultiplier, level: resolveLevel(plan, ratio, paceMultiplier) };
}

/** 表示順を安定させるため、深刻な方を優先して返す */
export function worstLevel(levels: UsageLevel[]): UsageLevel {
  const order: UsageLevel[] = ["critical", "warning", "notice", "normal"];
  return order.find((level) => levels.includes(level)) ?? "normal";
}
