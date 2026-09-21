import { eq } from "drizzle-orm";
import { userSettings } from "@modparks/core/db/schema";
import type { ProjectPost } from "@modparks/core/types/post";
import type { NotificationType, NotificationPayload } from "@modparks/core/notifications/types";
import * as core from "@modparks/core/notifications/dispatch";
import { getNextPushSender } from "@/lib/services/push";
import type { Database } from "@/lib/db";

/**
 * Next 側の通知アダプタ。
 *
 * 配信の本体は core/notifications/dispatch.ts にあり、ここは Web Push の送り手を
 * アンビエントに解決して渡すだけ。呼び出し元（Server Action 16 箇所ほか）の
 * シグネチャを変えないためにこの形にしている。
 *
 * notifyToUser だけは本体をここに残す。ユーザー宛ての Discord 送信が
 * next-intl の getTranslations を使っており core に置けないため。
 */

async function context(db: Database): Promise<core.NotifyContext> {
  return { db, push: await getNextPushSender() };
}

export async function dispatchNotifications(
  db: Database,
  recipientIds: string[],
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  await core.dispatchNotifications(await context(db), recipientIds, type, payload);
}

export async function notifyNewVersion(
  db: Database,
  project: Pick<ProjectPost, "id" | "slug" | "title" | "iconUrl" | "authorId" | "discordWebhookUrl">,
  versionNumber: string,
): Promise<void> {
  await core.notifyNewVersion(await context(db), project, versionNumber);
}

export async function notifyNewProject(
  db: Database,
  project: Pick<ProjectPost, "slug" | "title" | "iconUrl" | "authorId">,
  authorName: string,
): Promise<void> {
  await core.notifyNewProject(await context(db), project, authorName);
}

export const resolveActor = core.resolveActor;

/** 単一受信者向けイベント（コメント・いいね・お気に入り・フォロー・リスト追加） */
export async function notifyToUser(
  db: Database,
  recipientId: string,
  actorId: string,
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  if (recipientId === actorId) return;
  await dispatchNotifications(db, [recipientId], type, { ...payload, actorId });

  const settings = await db
    .select({ locale: userSettings.locale, discordWebhookUrl: userSettings.discordWebhookUrl })
    .from(userSettings)
    .where(eq(userSettings.userId, recipientId))
    .get();

  if (settings?.discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@modparks/core/notifications/discord");
    if (isValidDiscordWebhookUrl(settings.discordWebhookUrl)) {
      sendUserDiscordNotification(settings.discordWebhookUrl, settings.locale || "ja", type, payload);
    }
  }
}

/**
 * ユーザー宛ての通知内容を Discord Webhook へ送信する。
 * 例外は内部で処理し、呼び出し元の処理を妨げない。
 */
async function sendUserDiscordNotification(
  webhookUrl: string,
  locale: "ja" | "en",
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const { getTranslations } = await import("next-intl/server");
    const t = await getTranslations({ locale, namespace: "Notifications.message" });
    const message = t(type, payload as any);

    const embed = {
      title: "ModParks Notification",
      description: message,
      color: 0x38bdf8,
      timestamp: new Date().toISOString(),
      thumbnail: payload.actorImage ? { url: payload.actorImage } : undefined,
      footer: { text: "ModParks" },
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error("Failed to send user webhook notification:", err);
  }
}
