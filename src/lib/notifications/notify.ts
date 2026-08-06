import { notifications, projectSubscriptions, developerSubscriptions, userSettings, users, userProfiles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ProjectPost } from "@/types/post";
import { sendDiscordVersionNotification } from "@/lib/notifications/discord";
import { isTypeEnabled, type NotificationType, type NotificationPayload } from "@/lib/notifications/types";
import { sendPushToRecipients } from "@/lib/notifications/push";

/**
 * 通知の中央ディスパッチャ。受信者候補それぞれの通知設定を確認し、
 * その種別を無効化していない相手にのみアプリ内通知を挿入する。
 */
export async function dispatchNotifications(
  db: any,
  recipientIds: string[],
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  const targets = await filterByPreference(db, dedupe(recipientIds), type);
  if (targets.length === 0) return;

  await db.insert(notifications).values(
    targets.map((userId) => ({ userId, type, payload })),
  ).run();

  // アプリ内通知に相乗りして Web Push（PWA プッシュ通知）も配信する。
  // prefs フィルタ済みの受信者に対してのみ送る。配信失敗はアプリ内通知を妨げない。
  try {
    await sendPushToRecipients(db, targets, type, payload);
  } catch (e) {
    console.error("web push dispatch failed:", e);
  }
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

async function filterByPreference(db: any, ids: string[], type: NotificationType): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select({ userId: userSettings.userId, prefs: userSettings.notificationPrefs })
    .from(userSettings)
    .where(inArray(userSettings.userId, ids))
    .all();

  const disabled = new Set<string>();
  for (const row of rows) {
    if (!isTypeEnabled(row.prefs, type)) disabled.add(row.userId);
  }
  return ids.filter((id) => !disabled.has(id));
}

// ---- 各イベントのトリガー ----

/**
 * 新バージョン公開: プロジェクト購読者へ通知 + Discord Webhook 告知。
 */
export async function notifyNewVersion(
  db: any,
  project: Pick<ProjectPost, "id" | "slug" | "title" | "iconUrl" | "authorId" | "discordWebhookUrl">,
  versionNumber: string,
): Promise<void> {
  const subscribers = await db
    .select({ userId: projectSubscriptions.userId })
    .from(projectSubscriptions)
    .where(eq(projectSubscriptions.projectId, project.id))
    .all();

  const recipients = subscribers
    .map((s: { userId: string }) => s.userId)
    .filter((id: string) => id !== project.authorId);

  await dispatchNotifications(db, recipients, "new_version", {
    kind: "project",
    slug: project.slug,
    title: project.title,
    versionNumber,
    ...(project.iconUrl ? { iconUrl: project.iconUrl } : {}),
  });

  if (project.discordWebhookUrl) {
    await sendDiscordVersionNotification(project.discordWebhookUrl, {
      projectName: project.title,
      projectSlug: project.slug,
      projectIconUrl: project.iconUrl,
      versionNumber,
    });
  }
}

/**
 * 新プロジェクト公開: 作者を購読している（プロフィールのベルON）ユーザーへ通知。
 * フォローとは独立した購読（developer_subscriptions）を対象とする。
 */
export async function notifyNewProject(
  db: any,
  project: Pick<ProjectPost, "slug" | "title" | "iconUrl" | "authorId">,
  authorName: string,
): Promise<void> {
  const subscribers = await db
    .select({ userId: developerSubscriptions.subscriberId })
    .from(developerSubscriptions)
    .where(eq(developerSubscriptions.developerId, project.authorId))
    .all();

  const recipients = subscribers
    .map((s: { userId: string }) => s.userId)
    .filter((id: string) => id !== project.authorId);

  await dispatchNotifications(db, recipients, "new_project", {
    kind: "project",
    slug: project.slug,
    title: project.title,
    authorName,
    ...(project.iconUrl ? { iconUrl: project.iconUrl } : {}),
  });
}

/**
 * 通知の payload に載せる操作者の情報（表示名・アイコン・ユーザー名）を取得する。
 * 戻り値はそのまま payload へ spread する前提。actorImage は通知一覧のアバターと
 * Web Push の通知アイコンの両方に使う。
 */
export async function resolveActor(db: any, actorId: string): Promise<NotificationPayload> {
  const row = await db
    .select({
      displayName: userProfiles.displayName,
      username: userProfiles.username,
      avatarUrl: userProfiles.avatarUrl,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, actorId))
    .get();

  const actorImage = row?.avatarUrl || row?.image || "";
  return {
    actorName: row?.displayName || row?.name || row?.username || "",
    ...(row?.username ? { actorUsername: row.username } : {}),
    ...(actorImage ? { actorImage } : {}),
  };
}

/** 単一受信者向けイベント（コメント・いいね・お気に入り・フォロー・リスト追加） */
export async function notifyToUser(
  db: any,
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
    const { isValidDiscordWebhookUrl } = await import("@/lib/notifications/discord");
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
