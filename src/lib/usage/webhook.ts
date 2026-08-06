/**
 * 管理者向け通知の宛先を取得する。
 *
 * DDoS ガード（worker/ddos-notify.js）と同じ DISCORD_WEBHOOK_URL を使う。
 * Workers 本番では secret がバインディング env 側にあるため、
 * process.env だけでは取れない。
 */

interface WebhookEnv {
  DISCORD_WEBHOOK_URL?: string;
}

/** @returns 未設定なら undefined。呼び出し側は通知を諦めて処理を続ける */
export async function getAdminWebhookUrl(): Promise<string | undefined> {
  const fromProcess = process.env.DISCORD_WEBHOOK_URL;
  if (fromProcess) return fromProcess;

  // バインディングの取得は環境に依存するため、失敗しても通知なしとして続行する
  try {
    if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
      const { getCachedPlatformProxy } = await import("@/lib/proxy");
      return ((await getCachedPlatformProxy()).env as unknown as WebhookEnv).DISCORD_WEBHOOK_URL;
    }

    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as WebhookEnv).DISCORD_WEBHOOK_URL;
  } catch (err) {
    console.error("[USAGE] Failed to resolve admin webhook:", err);
    return undefined;
  }
}
