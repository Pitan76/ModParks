"use server";

import { getAdminDb, getAuditEmail } from "@/lib/auth-helpers";
import { getSettingsKV } from "@/lib/kv";
import { settingsAudit } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  SETTINGS_KEY,
  appSettingsSchema,
  normalizeAppSettings,
  type AppSettings,
} from "@/lib/config/appSettings";
import { getAppSettings } from "@/lib/config/readSettings";

/**
 * アプリ設定を更新する。
 * KV に全体を JSON で書き戻し、変更のあったキーだけを D1 の監査ログに残す。
 */
export async function updateAppSettings(
  input: Partial<AppSettings>
): Promise<{ success: true; settings: AppSettings; warning?: string } | { error: string }> {
  const { db, userId } = await getAdminDb();

  const current = await getAppSettings();
  const candidate = normalizeAppSettings({ ...current, ...input });

  const parsed = appSettingsSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
  }
  const next = parsed.data;

  if (next.apiDefaultLimit > next.apiMaxLimit) {
    return { error: "apiDefaultLimit must be less than or equal to apiMaxLimit" };
  }

  const changed = (Object.keys(next) as (keyof AppSettings)[]).filter(
    (key) => next[key] !== current[key]
  );
  if (changed.length === 0) {
    return { success: true, settings: next };
  }

  // 送信元アドレスを変えるときは、Resend で検証済みのドメインかを確認する。
  // 未検証のまま保存すると認証メールが一切送れなくなるため。
  let warning: string | undefined;
  if (changed.includes("mailFromAddress")) {
    const { checkSenderDomain } = await import("@/lib/utils/resendApi");
    const check = await checkSenderDomain(next.mailFromAddress);
    if (!check.ok && check.kind === "unverified") {
      const known = check.verified.length > 0 ? check.verified.join(", ") : "(none)";
      return {
        error: `Domain "${check.domain}" is not verified in Resend. Verified domains: ${known}`,
      };
    }
    if (!check.ok && check.kind === "unknown") {
      // Resend 側の障害で設定変更全体が止まらないよう、警告にとどめる
      warning = `Could not verify the sender domain with Resend (${check.reason}). Please confirm that email delivery still works.`;
    }
  }

  const kv = await getSettingsKV();
  await kv.put(SETTINGS_KEY, JSON.stringify(next));

  const changedByEmail = await getAuditEmail(db, userId);

  await db.insert(settingsAudit).values(
    changed.map((key) => ({
      scope: "app" as const,
      key,
      oldValue: JSON.stringify(current[key]),
      newValue: JSON.stringify(next[key]),
      changedBy: userId,
      changedByEmail,
    }))
  );

  revalidatePath("/admin/config");
  return { success: true, settings: next, warning };
}

/** 設定変更履歴を新しい順に取得する */
export async function listSettingsAudit(scope: "app" | "vars", limit = 20) {
  const { db } = await getAdminDb();
  return db
    .select()
    .from(settingsAudit)
    .where(eq(settingsAudit.scope, scope))
    .orderBy(desc(settingsAudit.createdAt))
    .limit(limit)
    .all();
}
