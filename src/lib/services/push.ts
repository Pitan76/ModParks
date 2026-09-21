import { createPushSender, type PushSender } from "@modparks/core/notifications/pushSender";
import type { VapidKeys } from "@modparks/core/notifications/pushTypes";

/**
 * Next 側の Web Push の送り手。
 *
 * 送信の本体は core にあり、ここは modparks-push の Service Binding と VAPID 鍵を
 * アンビエントに解決して渡すだけ。modparks-api は同じものを env から作る。
 */

interface PushEnv {
  PUSH?: Fetcher;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

async function getWorkerEnv(): Promise<PushEnv> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env as unknown as PushEnv;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");

  return (await getCloudflareContext({ async: true })).env as unknown as PushEnv;
}

/** 移設前の getVapid と同じ解決順。Workers 本番では secret は env 側にある */
function resolveVapid(env: PushEnv): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || process.env.VAPID_SUBJECT || "mailto:admin@modparks.pitan76.net";
  if (!publicKey || !privateKey) return null;

  return { publicKey, privateKey, subject };
}

/**
 * 環境変数とバインディングを読む。
 *
 * 取れなくても通知全体を止めないよう、ここで畳んで空として扱う。
 * 移設前の getVapid も同じく握りつぶしてプッシュだけを諦めていた。
 */
async function readPushEnv(): Promise<PushEnv> {
  // 外部I/O境界（プラットフォームのバインディング取得）なのでここで畳む
  try {
    return await getWorkerEnv();
  } catch {
    return {};
  }
}

/**
 * Next のリクエスト中に使う送り手を組み立てる。
 *
 * 例外は投げない。移設前は VAPID を先に見て、未設定なら PUSH に一切触れずに
 * 黙ってスキップしていた。ここで投げると PUSH を持たない環境（ローカル開発など）
 * でアプリ内通知まで巻き込んで失敗するため、送信時に初めて失敗する形に留める。
 * 送信の失敗は sendPushToRecipients が購読ごとに記録して握る。
 */
export async function getNextPushSender(): Promise<PushSender> {
  const env = await readPushEnv();
  const vapid = resolveVapid(env);
  if (env.PUSH) return createPushSender(env.PUSH, vapid);

  return {
    vapid,
    send: async () => {
      throw new Error("PUSH service binding not found (deploy modparks-push first)");
    },
  };
}
