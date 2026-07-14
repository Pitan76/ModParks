import { notifications, projectSubscriptions, userFollows, userSettings, users, userProfiles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { Project } from "@/db/schema";
import { sendDiscordVersionNotification } from "@/lib/notifications/discord";
import { isTypeEnabled, type NotificationType, type NotificationPayload } from "@/lib/notifications/types";

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
  project: Pick<Project, "id" | "slug" | "name" | "iconUrl" | "authorId" | "discordWebhookUrl">,
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
    projectSlug: project.slug,
    projectName: project.name,
    versionNumber,
    ...(project.iconUrl ? { projectIconUrl: project.iconUrl } : {}),
  });

  if (project.discordWebhookUrl) {
    await sendDiscordVersionNotification(project.discordWebhookUrl, {
      projectName: project.name,
      projectSlug: project.slug,
      projectIconUrl: project.iconUrl,
      versionNumber,
    });
  }
}

/**
 * 新プロジェクト公開: 作者のフォロワー（プロフィールのベルON）へ通知。
 */
export async function notifyNewProject(
  db: any,
  project: Pick<Project, "slug" | "name" | "iconUrl" | "authorId">,
  authorName: string,
): Promise<void> {
  const followers = await db
    .select({ userId: userFollows.followerId })
    .from(userFollows)
    .where(eq(userFollows.followingId, project.authorId))
    .all();

  const recipients = followers
    .map((f: { userId: string }) => f.userId)
    .filter((id: string) => id !== project.authorId);

  await dispatchNotifications(db, recipients, "new_project", {
    projectSlug: project.slug,
    projectName: project.name,
    authorName,
    ...(project.iconUrl ? { projectIconUrl: project.iconUrl } : {}),
  });
}

/** 通知の payload に載せる操作者の表示名を取得する */
export async function resolveActorName(db: any, actorId: string): Promise<string> {
  const row = await db
    .select({ displayName: userProfiles.displayName, name: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, actorId))
    .get();
  return row?.displayName || row?.name || "";
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
  await dispatchNotifications(db, [recipientId], type, payload);
}
