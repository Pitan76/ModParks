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
 * ユーザー宛ての Discord 文言は next-intl で翻訳して core へ渡す。
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

/**
 * Discord 文言の翻訳（Next 側）。next-intl の getTranslations を使う。
 */
const nextNotificationMessage: core.NotificationMessage = async (locale, type, payload) => {
  const { getTranslations } = await import("next-intl/server");
  const t = await getTranslations({ locale, namespace: "Notifications.message" });

  return t(type, payload as Record<string, string>);
};

/** 単一受信者向けイベント（コメント・いいね・お気に入り・フォロー・リスト追加） */
/**
 * ユーザー宛て通知の送り手（Next 側）。core の本体を直接呼ぶ Server Action が使う。
 */
export async function userNotifyContext(db: Database): Promise<core.UserNotifyContext> {
  return { ...(await context(db)), message: nextNotificationMessage };
}

export async function notifyToUser(
  db: Database,
  recipientId: string,
  actorId: string,
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  await core.notifyToUser(await userNotifyContext(db), recipientId, actorId, type, payload);
}
