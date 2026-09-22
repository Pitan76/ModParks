"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { isChreeIdProvisioningEnabled } from "@/lib/chreeid/client";
import { resyncChreeId, runChreeIdMigration } from "@/lib/chreeid/bulkMigration";
import type { ChreeIdResyncResult, ChreeIdRunResult } from "@/lib/chreeid/bulkMigration";

type Result<T> = { success: true; result: T } | { success: false; error: "NOT_CONFIGURED" };

/**
 * 未発行の利用者に ChreeID を1バッチぶん発行する。
 */
export async function runChreeIdMigrationAction(): Promise<Result<ChreeIdRunResult>> {
  const { db, userId } = await getAdminDb();
  if (!isChreeIdProvisioningEnabled()) return { success: false, error: "NOT_CONFIGURED" };

  const result = await runChreeIdMigration(db);
  console.warn("[ChreeID] bulk migration by", userId, { done: result.done, failed: result.failed, remaining: result.remaining });

  revalidatePath("/[locale]/admin/chreeid", "page");
  return { success: true, result };
}

/**
 * 紐付け済みの人も含めて ChreeID 側を1バッチぶん洗い直す。
 * @param offset 何人目から見るか
 */
export async function resyncChreeIdAction(offset: number): Promise<Result<ChreeIdResyncResult>> {
  const { db, userId } = await getAdminDb();
  if (!isChreeIdProvisioningEnabled()) return { success: false, error: "NOT_CONFIGURED" };

  const result = await resyncChreeId(db, offset);
  console.warn("[ChreeID] resync by", userId, { checked: result.checked, failed: result.failed, next: result.next });

  return { success: true, result };
}
