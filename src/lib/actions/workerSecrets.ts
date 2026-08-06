"use server";

import { getAdminDb, getReauthenticatedAdminDb, getAuditEmail } from "@/lib/auth-helpers";
import { settingsAudit } from "@/db/schema";
import { revalidatePath } from "next/cache";
import {
  getCloudflareApiConfig,
  listWorkerSecrets,
  putWorkerSecret,
  deleteWorkerSecret,
  PROTECTED_SECRETS,
} from "@/lib/utils/cloudflareApi";

export type SecretEntry = { name: string; editable: boolean };

const SECRET_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 登録済みシークレットの名前一覧を取得する（値は取得できない） */
export async function listSecrets(): Promise<
  { success: true; secrets: SecretEntry[] } | { error: string }
> {
  await getAdminDb();

  const cfg = getCloudflareApiConfig();
  if (!cfg) return { error: "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN is not configured" };

  try {
    const secrets = await listWorkerSecrets(cfg);
    return {
      success: true,
      secrets: secrets.map((s) => ({ name: s.name, editable: !PROTECTED_SECRETS.has(s.name) })),
    };
  } catch (error) {
    console.error("Failed to list worker secrets:", error);
    return { error: error instanceof Error ? error.message : "Failed to list secrets" };
  }
}

/**
 * シークレットを作成 / 上書きする。TOTP による再認証が必要。
 * 監査ログには名前だけを残し、値は一切保存しません。
 */
export async function setSecret(
  name: string,
  value: string,
  totpToken: string
): Promise<{ success: true } | { error: string }> {
  let ctx;
  try {
    ctx = await getReauthenticatedAdminDb(totpToken);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  if (!SECRET_NAME_PATTERN.test(name)) return { error: "INVALID_SECRET_NAME" };
  if (PROTECTED_SECRETS.has(name)) return { error: "SECRET_PROTECTED" };
  if (!value) return { error: "EMPTY_SECRET_VALUE" };

  const cfg = getCloudflareApiConfig();
  if (!cfg) return { error: "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN is not configured" };

  try {
    await putWorkerSecret(cfg, name, value);
    await ctx.db.insert(settingsAudit).values({
      scope: "secret",
      key: name,
      // 値は監査ログにも残さない
      oldValue: null,
      newValue: null,
      changedBy: ctx.userId,
      changedByEmail: await getAuditEmail(ctx.db, ctx.userId),
    });
    revalidatePath("/admin/config");
    return { success: true };
  } catch (error) {
    console.error("Failed to set worker secret:", error);
    return { error: error instanceof Error ? error.message : "Failed to set secret" };
  }
}

/** シークレットを削除する。TOTP による再認証が必要。 */
export async function removeSecret(
  name: string,
  totpToken: string
): Promise<{ success: true } | { error: string }> {
  let ctx;
  try {
    ctx = await getReauthenticatedAdminDb(totpToken);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  if (PROTECTED_SECRETS.has(name)) return { error: "SECRET_PROTECTED" };

  const cfg = getCloudflareApiConfig();
  if (!cfg) return { error: "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN is not configured" };

  try {
    await deleteWorkerSecret(cfg, name);
    await ctx.db.insert(settingsAudit).values({
      scope: "secret",
      key: name,
      oldValue: null,
      newValue: "(deleted)",
      changedBy: ctx.userId,
      changedByEmail: await getAuditEmail(ctx.db, ctx.userId),
    });
    revalidatePath("/admin/config");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete worker secret:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete secret" };
  }
}
