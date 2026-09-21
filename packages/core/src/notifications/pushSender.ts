import type { SendRequest, SendResult, VapidKeys } from "@modparks/core/notifications/pushTypes";

/**
 * Web Push の送り手。
 *
 * 本文の暗号化と VAPID 署名は modparks-push サイドカーが行うため、ここが持つのは
 * その Service Binding と署名に使う鍵だけ。どちらも環境から取るものなので、
 * core では組み立てずに受け取る。Next は getCloudflareContext から、
 * modparks-api はハンドラの env から作って渡す。
 */
export type PushSender = {
  /** 未設定なら null。その場合プッシュは送らない（アプリ内通知は別に入る） */
  vapid: VapidKeys | null;
  send(req: SendRequest): Promise<SendResult>;
};

/**
 * modparks-push の Service Binding と VAPID 鍵から送り手を作る。
 * @param push modparks-push への Service Binding
 * @param vapid VAPID 鍵。未設定なら null
 */
export function createPushSender(push: Fetcher, vapid: VapidKeys | null): PushSender {
  return { vapid, send: (req) => sendViaBinding(push, req) };
}

/** 1 購読へ 1 通知を配送する。失効（expired）した購読は呼び出し側で削除すること */
async function sendViaBinding(push: Fetcher, req: SendRequest): Promise<SendResult> {
  const res = await push.fetch("https://modparks-push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const payload = (await res.json()) as SendResult & { error?: string };
  if (!res.ok && res.status >= 500) throw new Error(payload.error || `push worker returned ${res.status}`);

  return payload;
}
