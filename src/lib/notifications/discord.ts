import { SITE_URL } from "@/lib/config";

/** Discord Webhook URL の許可ホスト。他ホストへの SSRF を防ぐ */
const ALLOWED_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

export function isValidDiscordWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(u.hostname) && u.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

interface DiscordVersionInput {
  projectName: string;
  projectSlug: string;
  projectIconUrl?: string | null;
  versionNumber: string;
}

/**
 * 新バージョン公開を Discord Webhook へ埋め込みメッセージとして送信する。
 * ネットワーク境界のため失敗は握りつぶし呼び出し元の処理を止めない。
 */
export async function sendDiscordVersionNotification(
  webhookUrl: string,
  input: DiscordVersionInput,
): Promise<void> {
  if (!isValidDiscordWebhookUrl(webhookUrl)) return;

  const url = `${SITE_URL}/projects/${input.projectSlug}`;
  const body = {
    embeds: [
      {
        title: `${input.projectName} ${input.versionNumber}`,
        url,
        description: `New version \`${input.versionNumber}\` is now available on ModParks.`,
        color: 0x38bdf8,
        thumbnail: input.projectIconUrl ? { url: input.projectIconUrl } : undefined,
        footer: { text: "ModParks" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // 通知の失敗はバージョン公開を妨げない
  }
}
