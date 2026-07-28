import { ddosAudit } from "@/db/schema";
import { getAuditEmail } from "@/lib/auth-helpers";
import type { DdosAudit } from "@/db/schema";

type DdosAction = DdosAudit["action"];

/**
 * DDoS 防護の状態遷移を監査ログに記録する。
 *
 * recordModerationAudit と同じく、記録の失敗で本来の遷移を巻き戻さないよう例外は握りつぶす。
 * performedBy を省略した場合はシステム（自動検知・Cron）による遷移として記録する。
 */
export async function recordDdosAudit(
  db: any,
  action: DdosAction,
  state: string,
  detail?: Record<string, unknown>,
  performedBy?: string
) {
  try {
    const email = performedBy ? await getAuditEmail(db, performedBy) : undefined;
    await db.insert(ddosAudit).values({
      action,
      state,
      detail: detail ?? null,
      performedBy: performedBy ?? null,
      performedByEmail: email ?? null,
    }).run();
  } catch (e) {
    console.error("failed to record ddos audit:", e);
  }
}
