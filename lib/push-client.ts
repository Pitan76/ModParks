"use client";

/**
 * ブラウザ側の Web Push 購読ヘルパー。
 * Service Worker（/sw.js）は PwaRegister が登録済みである前提。
 */

/** VAPID 公開鍵（base64url）を Uint8Array に変換する（applicationServerKey 用） */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** この環境で Web Push が使えるか */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** 現在この端末が購読済みか */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * プッシュ通知を有効化する。許可要求 → 購読 → サーバへ保存。
 * @returns 成功可否と、拒否など理由
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  // VAPID 公開鍵はビルド時定数(NEXT_PUBLIC_*)ではなく実行時にサーバから取得する。
  // wrangler [vars] はランタイム値でビルド時に埋め込めないため。
  let vapidKey: string | undefined;
  try {
    const keyRes = await fetch("/api/notifications/push");
    if (keyRes.ok) vapidKey = ((await keyRes.json()) as { vapidPublicKey?: string })?.vapidPublicKey;
  } catch {
    /* ignore */
  }
  if (!vapidKey) return { ok: false, reason: "no-vapid-key" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const res = await fetch("/api/notifications/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) return { ok: false, reason: "save-failed" };
  return { ok: true };
}

/** プッシュ通知を無効化する。サーバ削除 → ブラウザ購読解除。 */
export async function disablePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  await fetch("/api/notifications/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  await sub.unsubscribe().catch(() => {});
  return { ok: true };
}
