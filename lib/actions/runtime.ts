"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb, getAuditEmail } from "@/lib/auth-helpers";
import { settingsAudit } from "@/db/schema";
import { getRuntimeConfig, putRuntimeConfig } from "@/lib/runtime/state";
import {
  RUNTIME_FEATURES,
  RUNTIME_MODES,
  type RuntimeConfig,
  type RuntimeFeature,
  type RuntimeMode,
} from "@/lib/runtime/features";
import { applyModeChange } from "@/lib/runtime/mode";

function isKnownFeature(value: string): value is RuntimeFeature {
  return (RUNTIME_FEATURES as readonly string[]).includes(value);
}

/**
 * 機能スイッチを切り替える。
 *
 * 停止時は理由を必須にする。理由の無い停止は、後から見て
 * 「戻してよいのか」が判断できなくなるため。
 */
export async function setFeatureEnabled(
  feature: string,
  enabled: boolean,
  reason: string
): Promise<{ success: true; config: RuntimeConfig } | { error: string }> {
  const { db, userId } = await getAdminDb();

  if (!isKnownFeature(feature)) return { error: "Unknown feature" };
  if (!enabled && !reason.trim()) return { error: "Reason is required to disable a feature" };

  const current = await getRuntimeConfig();
  const before = current.features[feature];

  const next: RuntimeConfig = {
    ...current,
    features: {
      ...current.features,
      [feature]: enabled
        ? { enabled: true }
        : { enabled: false, reason: reason.trim(), disabledAt: Date.now() },
    },
  };

  await putRuntimeConfig(next);

  const changedByEmail = await getAuditEmail(db, userId);
  await db.insert(settingsAudit).values({
    scope: "app" as const,
    key: `runtime.${feature}`,
    oldValue: JSON.stringify(before ?? { enabled: true }),
    newValue: JSON.stringify(next.features[feature]),
    changedBy: userId,
    changedByEmail,
  });

  revalidatePath("/admin/runtime");
  return { success: true, config: next };
}

function isKnownMode(value: string): value is RuntimeMode {
  return (RUNTIME_MODES as readonly string[]).includes(value);
}

/**
 * 運用モードを切り替える。
 *
 * NORMAL 以外にするときは理由と期限を必須にする。
 * 無期限で止められると、戻し忘れたまま気づかれない事故が起きる。
 */
export async function setRuntimeMode(
  mode: string,
  reason: string,
  durationHours: number
): Promise<{ success: true } | { error: string }> {
  const { db, userId } = await getAdminDb();
  if (!isKnownMode(mode)) return { error: "Unknown mode" };

  const before = (await getRuntimeConfig()).mode ?? { mode: "NORMAL" as RuntimeMode };

  try {
    await applyModeChange({ mode, reason, durationHours });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to change mode" };
  }

  const changedByEmail = await getAuditEmail(db, userId);
  await db.insert(settingsAudit).values({
    scope: "app" as const,
    key: "runtime.mode",
    oldValue: JSON.stringify(before),
    newValue: JSON.stringify((await getRuntimeConfig()).mode),
    changedBy: userId,
    changedByEmail,
  });

  revalidatePath("/admin/runtime");
  return { success: true };
}
