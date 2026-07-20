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
): Promise<{ success: true; settings: AppSettings } | { error: string }> {
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
  return { success: true, settings: next };
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
