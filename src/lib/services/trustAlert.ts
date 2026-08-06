/**
 * 信頼ポイントまわりの管理者向け通知。
 *
 * 宛先は予算アラートや DDoS ガードと同じ Discord Webhook にそろえる。
 * 管理者向けの警報を複数の経路に散らすと、どれを見ればよいか分からなくなるため。
 *
 * 管理画面は「探しに行く場所」ではなく「通知から飛んでくる場所」にする。
 * どの通知にも対象への直リンクを必ず載せる。
 */
import { isValidDiscordWebhookUrl } from "@/lib/notifications/discord";
import { SITE_URL } from "@/lib/config";

const COLOR_DANGER = 0xff0000;
const COLOR_WARNING = 0xffaa00;

type Embed = {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp: string;
};

function trustDetailUrl(userId: string): string {
  return `${SITE_URL}/ja/admin/trust/${userId}`;
}

export type MalwareAlertInput = {
  userId: string;
  userLabel: string;
  versionId: string;
  projectName: string;
  /** 記録した減点。スコアを 0 にする値なので、そのユーザの直前のスコアと一致する */
  delta: number;
};

/**
 * 確定検知の記録を知らせる。
 *
 * スキャンが「マルウェア確定」と言っても本当にそうかは分からないため、
 * 管理者が中身を確認して覆せるよう、必ず人の目に入れる。
 */
export function buildMalwareEmbed(input: MalwareAlertInput): Embed {
  return {
    title: "🚨 マルウェア確定検知",
    description: "確定検知としてブロックし、信頼ポイントを 0 に落としました。誤検知の可能性があるため内容を確認してください。",
    color: COLOR_DANGER,
    fields: [
      { name: "ユーザー", value: input.userLabel, inline: true },
      { name: "プロジェクト", value: input.projectName, inline: true },
      { name: "減点", value: String(input.delta), inline: true },
      { name: "信頼ポイント詳細", value: trustDetailUrl(input.userId) },
      { name: "スキャンログ", value: `${SITE_URL}/ja/admin/scans` },
    ],
    timestamp: new Date().toISOString(),
  };
}

export type ReportQueueAlertInput = {
  /** 未処理の通報件数 */
  pending: number;
  /** 再通知かどうか。初回と区別できないと通知疲れの原因になる */
  reminder: boolean;
};

/** 審査キューが放置されていることを知らせる */
export function buildReportQueueEmbed(input: ReportQueueAlertInput): Embed {
  return {
    title: input.reminder ? "⏰ 未処理の通報（再通知）" : "⚠️ 通報が届いています",
    description: "通報だけではコンテンツは非表示になりません。判断は管理者が行う必要があります。",
    color: COLOR_WARNING,
    fields: [
      { name: "未処理件数", value: String(input.pending), inline: true },
      { name: "通報一覧", value: `${SITE_URL}/ja/admin/reports` },
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Discord へ送る。
 * ネットワーク境界なので失敗は握りつぶし、呼び出し元の処理は止めない。
 */
export async function sendTrustAlert(webhookUrl: string | undefined, embed: Embed): Promise<void> {
  if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error("[TRUST] Failed to send alert:", err);
  }
}
