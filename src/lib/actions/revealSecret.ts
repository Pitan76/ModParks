"use server";

import { getReauthenticatedAdminDb, getAuditEmail } from "@/lib/auth-helpers";
import { settingsAudit } from "@modparks/core/db/schema";

/**
 * 【一時的】値を失った Web Push の鍵を回収するためだけの機能。
 *
 * Cloudflare のシークレットは API からもダッシュボードからも読み出せないが、
 * 実行中の Worker 自身は env から参照できる。それを管理者にだけ一度見せる。
 * modparks-api へ同じ値を設定し終えたら、このファイルと SecretRevealPanel.tsx を
 * 丸ごと削除すること。常設してよい機能ではない。
 *
 * AUTH_SECRET は対象に含めない。漏れると全員になりすませる Cookie を作れて
 * しまうため。一致の確認は GET /api/app/session で副作用なしに行える。
 */
const REVEALABLE = new Set(["VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);

export async function revealSecret(
  name: string,
  totpToken: string
): Promise<{ success: true; value: string } | { error: string }> {
  let ctx;
  try {
    ctx = await getReauthenticatedAdminDb(totpToken);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  if (!REVEALABLE.has(name)) return { error: "SECRET_NOT_REVEALABLE" };

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const env = (await getCloudflareContext({ async: true })).env as unknown as Record<string, unknown>;
  const value = env[name];
  if (typeof value !== "string" || !value) return { error: "SECRET_NOT_FOUND" };

  // 見せたこと自体を残す。値は監査ログにも残さない。一時機能のためにスキーマの
  // scope 列挙は増やさず、キーの接頭辞で「設定」ではなく「表示」だと区別する
  await ctx.db.insert(settingsAudit).values({
    scope: "secret",
    key: `reveal:${name}`,
    oldValue: null,
    newValue: null,
    changedBy: ctx.userId,
    changedByEmail: await getAuditEmail(ctx.db, ctx.userId),
  });

  return { success: true, value };
}
