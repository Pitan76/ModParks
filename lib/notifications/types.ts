/** 通知種別。DB(notifications.type)と設定(notificationPrefs)のキーを兼ねる */
export const NOTIFICATION_TYPES = [
  "new_project",
  "new_version",
  "project_comment",
  "idea_comment",
  "idea_like",
  "project_favorite",
  "follow",
  "list_add",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** 通知ペイロード。種別ごとに含むキーは異なるが、表示は文字列マップで統一する */
export type NotificationPayload = Record<string, string>;

export type NotificationPrefs = Record<NotificationType, boolean>;

/** 未設定の種別はONとして扱う */
export function isTypeEnabled(prefs: Record<string, boolean> | null | undefined, type: NotificationType): boolean {
  if (!prefs) return true;
  return prefs[type] !== false;
}

/** 設定UI用に、全種別を明示的な真偽値へ正規化する */
export function normalizePrefs(prefs: Record<string, boolean> | null | undefined): NotificationPrefs {
  const result = {} as NotificationPrefs;
  for (const type of NOTIFICATION_TYPES) result[type] = isTypeEnabled(prefs, type);
  return result;
}
