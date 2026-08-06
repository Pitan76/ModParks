/**
 * 予算アラートの判定と発報。
 *
 * 毎時走るため、同じ深刻度で鳴らし続けないことを最優先に置く。
 * 鳴りすぎるアラートは無視されるようになり、本当に危険なときに効かなくなる。
 */
import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { usageAlertState } from "@/db/schema";
import { getUsageOverview } from "@/lib/queries/usageOverview";
import { sendUsageAlert } from "@/lib/usage/alertNotify";
import type { UsageLevel, UsagePlan } from "@/lib/usage/quota";

/** 深刻度の強さ。数値が大きいほど深刻 */
const LEVEL_RANK: Record<UsageLevel, number> = {
  normal: 0,
  notice: 1,
  warning: 2,
  critical: 3,
};

/**
 * 管理者に取ってほしい行動。
 * 「何が起きたか」だけでは動けないので、次の一手まで書く。
 */
const ACTION_TEXT: Record<UsagePlan, Partial<Record<UsageLevel, string>>> = {
  free: {
    notice: "消費ペースが想定を上回っています。原因を確認してください。",
    warning: "当日枠の6割を超えました。**管理画面が使えるうちに**機能スイッチで抑えてください。",
    critical: "当日枠の8割を超えました。枠が尽きると管理画面も開けなくなります。静的専用ビルドへの切り替えを検討してください。",
  },
  paid: {
    notice: "消費ペースが想定を上回っています。原因を確認してください。",
    warning: "含有枠の8割に達しました。原因を分類してください。",
    critical: "含有枠を超えました。追加課金が発生しています。",
  },
};

/** 判定期間のキー。free は日、paid は月 */
function toPeriodKey(plan: UsagePlan, now: Date = new Date()): string {
  const iso = now.toISOString();
  return plan === "free" ? iso.slice(0, 10) : iso.slice(0, 7);
}

/** その期間で最後に通知した深刻度 */
async function readNotifiedLevel(
  db: Awaited<ReturnType<typeof getDatabase>>,
  periodKey: string
): Promise<UsageLevel> {
  const row = await db
    .select({ level: usageAlertState.level })
    .from(usageAlertState)
    .where(eq(usageAlertState.periodKey, periodKey))
    .get();

  return (row?.level as UsageLevel) ?? "normal";
}

async function markNotified(
  db: Awaited<ReturnType<typeof getDatabase>>,
  periodKey: string,
  level: UsageLevel
): Promise<void> {
  const values = { periodKey, level, notifiedAt: Date.now() };

  await db
    .insert(usageAlertState)
    .values(values)
    .onConflictDoUpdate({ target: usageAlertState.periodKey, set: values })
    .run();
}

/**
 * 利用量を評価し、深刻度が上がっていれば通知する。
 *
 * 下がったときは通知しない。回復は急ぐ話ではなく、
 * 「鳴ったのに何もしなくてよかった」という学習を管理者にさせないため。
 *
 * @param webhookUrl Discord Webhook。未設定なら判定だけ行って通知しない
 * @returns 通知した深刻度。通知しなければ null
 */
export async function evaluateUsageAlert(webhookUrl: string | undefined): Promise<UsageLevel | null> {
  const overview = await getUsageOverview();
  if (overview.level === "normal") return null;

  const db = await getDatabase();
  const periodKey = toPeriodKey(overview.plan);
  const notified = await readNotifiedLevel(db, periodKey);
  if (LEVEL_RANK[overview.level] <= LEVEL_RANK[notified]) return null;

  // 通知先が無くても状態は進めておく。設定後に過去分をまとめて鳴らさないため
  await markNotified(db, periodKey, overview.level);
  if (!webhookUrl) return null;

  const { requests } = overview;
  await sendUsageAlert(webhookUrl, {
    level: overview.level,
    plan: overview.plan,
    periodKey,
    used: requests.used,
    quota: requests.quota,
    ratio: requests.ratio ?? 0,
    paceMultiplier: requests.paceMultiplier,
    action: ACTION_TEXT[overview.plan][overview.level] ?? "",
  });

  return overview.level;
}
