import { eq, inArray } from "drizzle-orm";
import { notifications, projectSubscriptions, developerSubscriptions, userSettings, users, userProfiles } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import type { ProjectPost } from "@modparks/core/types/post";
import { sendDiscordVersionNotification } from "@modparks/core/notifications/discord";
import { isTypeEnabled, type NotificationType, type NotificationPayload } from "@modparks/core/notifications/types";
import { sendPushToRecipients } from "@modparks/core/notifications/push";
import type { PushSender } from "@modparks/core/notifications/pushSender";

/**
 * 通知の中央ディスパッチャ。
 *
 * Web Push の送り手は環境から作るものなので引数で受け取る。Next 側の同名関数は
 * これに getCloudflareContext から作った送り手を渡すアダプタになっている。
 */
export type NotifyContext = { db: Database; push: PushSender };

/**
 * 受信者候補それぞれの通知設定を確認し、その種別を無効化していない相手にのみ
 * アプリ内通知を挿入する。あわせて Web Push も配信する。
 */
export async function dispatchNotifications(
  ctx: NotifyContext,
  recipientIds: string[],
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  const { db } = ctx;
  const targets = await filterByPreference(db, dedupe(recipientIds), type);
  if (targets.length === 0) return;

  await db.insert(notifications).values(targets.map((userId) => ({ userId, type, payload }))).run();

  // prefs フィルタ済みの受信者に対してのみ送る。配信失敗はアプリ内通知を妨げない
  try {
    await sendPushToRecipients(db, ctx.push, targets, type, payload);
  } catch (e) {
    console.error("web push dispatch failed:", e);
  }
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

async function filterByPreference(db: Database, ids: string[], type: NotificationType): Promise<string[]> {
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

/** 新バージョン公開: プロジェクト購読者へ通知 + Discord Webhook 告知 */
export async function notifyNewVersion(
  ctx: NotifyContext,
  project: Pick<ProjectPost, "id" | "slug" | "title" | "iconUrl" | "authorId" | "discordWebhookUrl">,
  versionNumber: string,
): Promise<void> {
  const subscribers = await ctx.db
    .select({ userId: projectSubscriptions.userId })
    .from(projectSubscriptions)
    .where(eq(projectSubscriptions.projectId, project.id))
    .all();

  const recipients = subscribers.map((s: { userId: string }) => s.userId).filter((id: string) => id !== project.authorId);

  await dispatchNotifications(ctx, recipients, "new_version", {
    kind: "project",
    slug: project.slug,
    title: project.title,
    versionNumber,
    ...(project.iconUrl ? { iconUrl: project.iconUrl } : {}),
  });

  if (!project.discordWebhookUrl) return;
  await sendDiscordVersionNotification(project.discordWebhookUrl, {
    projectName: project.title,
    projectSlug: project.slug,
    projectIconUrl: project.iconUrl,
    versionNumber,
  });
}

/**
 * 新プロジェクト公開: 作者を購読している（プロフィールのベルON）ユーザーへ通知。
 * フォローとは独立した購読（developer_subscriptions）を対象とする。
 */
export async function notifyNewProject(
  ctx: NotifyContext,
  project: Pick<ProjectPost, "slug" | "title" | "iconUrl" | "authorId">,
  authorName: string,
): Promise<void> {
  const subscribers = await ctx.db
    .select({ userId: developerSubscriptions.subscriberId })
    .from(developerSubscriptions)
    .where(eq(developerSubscriptions.developerId, project.authorId))
    .all();

  const recipients = subscribers.map((s: { userId: string }) => s.userId).filter((id: string) => id !== project.authorId);

  await dispatchNotifications(ctx, recipients, "new_project", {
    kind: "project",
    slug: project.slug,
    title: project.title,
    authorName,
    ...(project.iconUrl ? { iconUrl: project.iconUrl } : {}),
  });
}

/**
 * 通知の payload に載せる操作者の情報（表示名・アイコン・ユーザー名）を取得する。
 * 戻り値はそのまま payload へ spread する前提。
 */
export async function resolveActor(db: Database, actorId: string): Promise<NotificationPayload> {
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
