import type { SendRequest, SendResult } from "@/workers/push/src/types";

/**
 * modparks-push Worker のクライアント。
 *
 * Web Push の本文暗号化（aes128gcm）と VAPID 署名は Node crypto 依存の web-push が
 * Workers で動かないため、Web Crypto 実装をサイドカー Worker に隔離している。ここは
 * Service Binding 越しの呼び出しだけを担う。
 */
async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

async function getPushWorker(): Promise<Fetcher> {
  const env = await getWorkerEnv();
  const push = (env as unknown as { PUSH?: Fetcher }).PUSH;
  if (!push) throw new Error("PUSH service binding not found (deploy modparks-push first)");
  return push;
}

/** 1 購読へ 1 通知を配送する。失効（expired）した購読は呼び出し側で削除すること。 */
export async function sendPush(req: SendRequest): Promise<SendResult> {
  const push = await getPushWorker();
  const res = await push.fetch("https://modparks-push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const payload = (await res.json()) as SendResult & { error?: string };
  if (!res.ok && res.status >= 500) {
    throw new Error(payload.error || `push worker returned ${res.status}`);
  }
  return payload;
}

export type { SendResult };
