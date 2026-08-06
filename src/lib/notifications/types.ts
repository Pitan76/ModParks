/**
 * 通知種別。DB(notifications.type)と設定(notificationPrefs)のキーを兼ねる。
 *
 * Post 統合により、Project / Idea で分かれていた種別を統合した。
 *   project_comment + idea_comment → comment
 *   project_favorite + idea_like   → favorite
 * 対象が Project か Idea かは payload.kind で判別する。
 */
export const NOTIFICATION_TYPES = [
  "new_project",
  "new_version",
  "comment",
  "favorite",
  "follow",
  "list_add",
  "comment_reply",
  "scan_result",
  "scan_appeal_result",
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
