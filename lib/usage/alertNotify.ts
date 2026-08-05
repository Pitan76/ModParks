/**
 * 予算アラートの通知。
 *
 * 宛先は DDoS ガードと同じ Discord Webhook にそろえる。
 * 管理者向けの警報を複数の経路に散らすと、どれを見ればよいか分からなくなるため。
 */
import { isValidDiscordWebhookUrl } from "@/lib/notifications/discord";
import type { UsageLevel } from "@/lib/usage/quota";

/** 深刻度に対応する Discord 埋め込みの色 */
const LEVEL_COLOR: Record<UsageLevel, number> = {
  normal: 0x22c55e,
  notice: 0x38bdf8,
  warning: 0xffaa00,
  critical: 0xff0000,
};

const LEVEL_TITLE: Record<UsageLevel, string> = {
  normal: "✅ ModParks 利用量 正常化",
  notice: "ℹ️ ModParks 利用量 注意",
  warning: "⚠️ ModParks 利用量 警告",
  critical: "🚨 ModParks 利用量 危険",
};

export type UsageAlertInput = {
  level: UsageLevel;
  plan: "free" | "paid";
  periodKey: string;
  used: number;
  quota: number;
  ratio: number;
  /** 期間の経過割合に対する超過倍率 */
  paceMultiplier: number | null;
  /** 管理者に取ってほしい行動 */
  action: string;
};

function buildEmbed(input: UsageAlertInput) {
  const fields = [
    { name: "プラン", value: input.plan, inline: true },
    { name: "期間", value: input.periodKey, inline: true },
    { name: "リクエスト", value: `${input.used.toLocaleString()} / ${input.quota.toLocaleString()}`, inline: true },
    { name: "消費率", value: `${(input.ratio * 100).toFixed(1)}%`, inline: true },
  ];

  if (input.paceMultiplier !== null) {
    fields.push({ name: "想定ペース比", value: `${input.paceMultiplier.toFixed(2)}x`, inline: true });
  }

  return {
    title: LEVEL_TITLE[input.level],
    description: input.action,
    color: LEVEL_COLOR[input.level],
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 予算アラートを Discord へ送る。
 * ネットワーク境界のため失敗は握りつぶし、判定処理そのものは止めない。
 */
export async function sendUsageAlert(webhookUrl: string, input: UsageAlertInput): Promise<void> {
  if (!isValidDiscordWebhookUrl(webhookUrl)) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [buildEmbed(input)] }),
    });
  } catch (err) {
    console.error("[USAGE] Failed to send budget alert:", err);
  }
}
