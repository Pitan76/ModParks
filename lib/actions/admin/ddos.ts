"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/auth-helpers";
import { ddosState } from "@/db/schema";
import { recordDdosAudit } from "@/lib/actions/ddosAudit";

/** 既定の防護継続時間(ms)。手動解除しなかった場合はこの時間で自動的に戻す */
const DEFAULT_PROTECTION_DURATION_MS = 600_000;

interface WafResult {
  success: boolean;
  error?: string;
}

/** WAFルールを無効化するときに使う、決して一致しないダミー式 */
const NEVER_MATCH_EXPRESSION = `(http.request.uri.path eq "/dev/null")`;

function buildWafExpression(enable: boolean, topSlug: string): string {
  // slug をそのまま式に埋め込むため、想定外の文字が来たら絞り込みを諦めてパス全体を対象にする
  const isSafeSlug = topSlug && /^[a-z0-9-]{1,64}$/.test(topSlug);
  if (enable && isSafeSlug) {
    return `(http.request.uri.path contains "/api/download" and http.request.uri.args["slug"][0] eq "${topSlug}")`;
  }
  return `(http.request.uri.path contains "/api/download")`;
}

/**
 * Cloudflare の WAF ルール（Rulesets API）を切り替える。
 * @param topSlug 攻撃が集中しているプロジェクト。指定するとそのプロジェクトのみを対象にする
 */
async function toggleWaf(enable: boolean, topSlug = ""): Promise<WafResult> {
  const isDryRun = process.env.DRY_RUN === "true";
  console.log(`[DDOS-ACTION] toggleWaf: enable=${enable}, topSlug=${topSlug}, dryRun=${isDryRun}`);

  if (isDryRun) return { success: true };

  const token = process.env.CF_WAF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  const rulesetId = process.env.CF_RULESET_ID;
  const ruleId = process.env.CF_WAF_RULE_ID;

  if (!token || !zoneId || !rulesetId || !ruleId) {
    console.error("[DDOS-ACTION] Missing Cloudflare API configuration environment variables");
    return { success: false, error: "Missing config" };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`;
  const body = enable
    ? { enabled: true, expression: buildWafExpression(true, topSlug), action: "managed_challenge" }
    : { enabled: false, expression: NEVER_MATCH_EXPRESSION, action: "managed_challenge" };

  // 外部APIの失敗で管理画面ごと落とさないよう、ここで結果に畳み込む
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { success?: boolean; errors?: unknown };
    if (!res.ok || !data.success) {
      return { success: false, error: data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** DDoS防御の現在状態を返す。未初期化なら NORMAL の行を作ってから返す */
export async function getDdosStateAction() {
  const { db } = await getAdminDb();

  const existing = await db.select().from(ddosState).where(eq(ddosState.stateKey, "global")).get();
  if (existing) return existing;

  await db.insert(ddosState).values({
    stateKey: "global",
    currentState: "NORMAL",
    attackDetectedAt: 0,
    underAttackEnabledAt: 0,
    scheduledDisableAt: 0,
    cooldownUntil: 0,
    updatedAt: Date.now(),
    protectionDuration: DEFAULT_PROTECTION_DURATION_MS,
    lastNormalAt: 0,
  }).run();

  return await db.select().from(ddosState).where(eq(ddosState.stateKey, "global")).get();
}

/** 管理者が手動で防護モードを切り替える。WAF更新に失敗した場合はDBを書き換えない */
export async function toggleManualUnderAttack(enable: boolean, durationMinutes = 10) {
  const { db, userId } = await getAdminDb();
  const now = Date.now();

  const before = await db.select({ currentState: ddosState.currentState })
    .from(ddosState)
    .where(eq(ddosState.stateKey, "global"))
    .get();

  const apiRes = await toggleWaf(enable, "");
  if (!apiRes.success) return { error: `Cloudflare API error: ${apiRes.error}` };

  const durationMs = durationMinutes * 60 * 1000;
  const nextState = enable
    ? {
        currentState: "UNDER_ATTACK" as const,
        attackDetectedAt: now,
        underAttackEnabledAt: now,
        scheduledDisableAt: now + durationMs,
        protectionDuration: durationMs,
        updatedAt: now,
      }
    : {
        currentState: "NORMAL" as const,
        scheduledDisableAt: 0,
        protectionDuration: DEFAULT_PROTECTION_DURATION_MS,
        updatedAt: now,
      };

  await db.update(ddosState).set(nextState).where(eq(ddosState.stateKey, "global")).run();

  await recordDdosAudit(
    db,
    enable ? "manual_activate" : "manual_deactivate",
    enable ? "UNDER_ATTACK" : "NORMAL",
    {
      previousState: before?.currentState ?? null,
      ...(enable ? { protectionDuration: durationMs } : {}),
    },
    userId,
  );

  revalidatePath("/admin/config");
  return { success: true };
}
