"use server";

import { revalidatePath } from "next/cache";
import { getAdminDb, getAuditEmail } from "@/lib/auth-helpers";
import { settingsAudit } from "@/db/schema";
import { getRuntimeConfig, putRuntimeConfig } from "@/lib/runtime/state";
import {
  RUNTIME_FEATURES,
  type RuntimeConfig,
  type RuntimeFeature,
} from "@/lib/runtime/features";

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
