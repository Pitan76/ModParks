import { moderationAudit } from "@/db/schema";
import { getAuditEmail } from "@/lib/auth-helpers";
import type { ModerationAudit } from "@/db/schema";

type ModerationAction = ModerationAudit["action"];

/**
 * モデレーション操作を監査ログに記録する。
 *
 * 記録の失敗で本来の操作を巻き戻すべきではないため、ここでは例外を握りつぶす。
 * （呼び出し側は既に権限チェック済みの管理操作を完了している）
 */
export async function recordModerationAudit(
  db: any,
  action: ModerationAction,
  targetId: string,
  performedBy: string,
  detail?: Record<string, unknown>
) {
  try {
    const email = await getAuditEmail(db, performedBy);
    await db.insert(moderationAudit).values({
      action,
      targetId,
      detail: detail ?? null,
      performedBy,
      performedByEmail: email ?? null,
    }).run();
  } catch (e) {
    console.error("failed to record moderation audit:", e);
  }
}
