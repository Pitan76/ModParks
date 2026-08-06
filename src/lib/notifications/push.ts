import { pushSubscriptions, userSettings } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { NotificationType, NotificationPayload } from "@/lib/notifications/types";
import { sendPush } from "@/lib/services/push";

/**
 * Web Push（PWA プッシュ通知）配信。
 *
 * アプリ内通知（dispatchNotifications）に相乗りして呼ばれる。受信者は既に
 * notificationPrefs でフィルタ済みなので、ここでは端末（購読）の有無だけを見る。
 * 本文暗号化と VAPID 署名は modparks-push サイドカーが行う（Web Crypto 実装）。
 */

interface VapidEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

async function getVapid(): Promise<{ publicKey: string; privateKey: string; subject: string } | null> {
  let env: VapidEnv = process.env as unknown as VapidEnv;
  // Workers 本番では secret はバインディング env 側にあるため fallback で取得する
  if (!env.VAPID_PRIVATE_KEY) {
    try {
      if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
        const { getCachedPlatformProxy } = await import("@/lib/proxy");
        env = (await getCachedPlatformProxy()).env as unknown as VapidEnv;
      } else {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        env = (await getCloudflareContext({ async: true })).env as unknown as VapidEnv;
      }
    } catch {
      /* ignore */
    }
  }
  const publicKey = env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || process.env.VAPID_SUBJECT || "mailto:admin@modparks.pitan76.net";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/**
 * プッシュ本文テンプレート（種別 → 文言）。
 * 意図的にインライン定義し、全 i18n メッセージJSON（~127KB）をメイン Worker の
 * バンドルに巻き込まないようにしている（本体は 3 MiB 制限に張り付いているため）。
 * messages/*.json の Notifications.message と表現を揃えること。
 */
const PUSH_TEMPLATES: Record<"ja" | "en", Record<string, string>> = {
  ja: {
    new_project: "{authorName} が新しいプロジェクト「{projectName}」を公開しました",
    new_version: "「{projectName}」の新しいバージョン {versionNumber} が公開されました",
    project_comment: "{actorName} が「{projectName}」にコメントしました",
    idea_comment: "{actorName} がアイデア「{ideaTitle}」にコメントしました",
    idea_like: "{actorName} がアイデア「{ideaTitle}」にいいねしました",
    project_favorite: "{actorName} が「{projectName}」をお気に入りに登録しました",
    follow: "{actorName} があなたをフォローしました",
    list_add: "{actorName} が「{projectName}」をリスト「{collectionName}」に追加しました",
    comment_reply: "{actorName} があなたのコメントに返信しました",
  },
  en: {
    new_project: '{authorName} published a new project "{projectName}"',
    new_version: 'New version {versionNumber} of "{projectName}" is available',
    project_comment: '{actorName} commented on "{projectName}"',
    idea_comment: '{actorName} commented on idea "{ideaTitle}"',
    idea_like: '{actorName} liked your idea "{ideaTitle}"',
    project_favorite: '{actorName} favorited "{projectName}"',
    follow: "{actorName} started following you",
    list_add: '{actorName} added "{projectName}" to list "{collectionName}"',
    comment_reply: "{actorName} replied to your comment",
  },
};

/** payload の文字列を通知テンプレートに差し込む */
function interpolate(template: string, payload: NotificationPayload): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => payload[key] ?? "");
}

function getTemplates(locale: string): Record<string, string> {
  return PUSH_TEMPLATES[locale === "en" ? "en" : "ja"];
}

/** 通知種別ごとの遷移先 URL を決める */
function targetUrl(locale: string, payload: NotificationPayload): string {
  if (payload.slug) {
    const segment = payload.kind === "idea" ? "ideas" : "projects";
    return `/${locale}/${segment}/${payload.slug}`;
  }
  return `/${locale}/notifications`;
}

/**
 * 受信者（prefs 済み）へ Web Push を配信する。
 * 端末を持たない受信者は無視。失効した購読は DB から削除する。
 */
export async function sendPushToRecipients(
  db: any,
  recipientIds: string[],
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  if (recipientIds.length === 0) return;

  const vapid = await getVapid();
  if (!vapid) return; // VAPID 未設定なら黙ってスキップ（アプリ内通知は既に入っている）

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, recipientIds))
    .all();

  if (subs.length === 0) return;

  // 受信者ごとのロケール（未設定は ja）
  const settingRows = await db
    .select({ userId: userSettings.userId, locale: userSettings.locale })
    .from(userSettings)
    .where(inArray(userSettings.userId, recipientIds))
    .all();
  const localeByUser = new Map<string, string>(
    settingRows.map((r: { userId: string; locale: string }) => [r.userId, r.locale]),
  );

  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (sub: {
      id: string; userId: string; endpoint: string; p256dh: string; auth: string;
    }) => {
      const locale = localeByUser.get(sub.userId) || "ja";
      const templates = getTemplates(locale);
      const body = interpolate(templates[type] ?? "", payload) || "ModParks";

      const message = JSON.stringify({
        title: "ModParks",
        body,
        url: targetUrl(locale, payload),
        // 人が起点の通知（コメント・フォロー等）はその人のアバター、
        // システム起点（新バージョン・新規公開）はプロジェクトアイコン、
        // どちらも無ければ ModParks のアイコンにフォールバックする
        icon: payload.actorImage || payload.iconUrl || "/icon.png",
        tag: type,
      });

      try {
        const res = await sendPush({
          subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload: message,
          vapid,
        });
        if (res.expired) expiredIds.push(sub.id);
      } catch (e) {
        console.error("push send failed:", e);
      }
    }),
  );

  if (expiredIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expiredIds)).run();
  }
}
