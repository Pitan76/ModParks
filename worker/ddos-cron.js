import {
  COOLDOWN_AFTER_API_FAILURE_MS,
  COOLDOWN_AFTER_DEACTIVATE_MS,
  SLICE_RETENTION_SEC,
  TRANSITION_TIMEOUT_MS,
} from "./ddos-config.js";
import { toggleDdosProtection, fetchCurrentWafRuleStatus } from "./ddos-waf.js";
import { getDdosState, invalidateDdosState } from "./ddos-state.js";
import { recordDdosAudit, notifyDeactivated } from "./ddos-notify.js";

/** 防護期限が切れた UNDER_ATTACK を解除して COOLDOWN へ移す */
async function handleScheduledDisable(db, env, state, now) {
  console.log("[DDOS-GUARD] Scheduled disable time reached. Toggling rules to off...");

  const lockRes = await db.prepare(
    "UPDATE ddos_state SET current_state = 'DEACTIVATING', updated_at = ? WHERE state_key = 'global' AND current_state = 'UNDER_ATTACK'"
  ).bind(now).run();
  if (lockRes.meta.changes !== 1) return;

  const apiRes = await toggleDdosProtection(env, false, "");

  if (!apiRes.success) {
    console.error("[DDOS-GUARD] Failed to disable WAF rule:", apiRes.error);
    // 次の Cron で再試行できるよう UNDER_ATTACK に戻す
    await db.prepare(
      "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', updated_at = ? WHERE state_key = 'global'"
    ).bind(now).run();
    invalidateDdosState();
    await recordDdosAudit(db, "auto_deactivate_failed", "UNDER_ATTACK", { error: apiRes.error });
    return;
  }

  const cooldownUntil = now + COOLDOWN_AFTER_DEACTIVATE_MS;
  await db.prepare(
    "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
  ).bind(cooldownUntil, now, now).run();
  invalidateDdosState();
  console.log("[DDOS-GUARD] Successfully disabled WAF rule. System is in COOLDOWN");

  await recordDdosAudit(db, "auto_deactivate", "COOLDOWN", {
    underAttackEnabledAt: state.underAttackEnabledAt,
    protectionDuration: state.protectionDuration,
    cooldownUntil,
    dryRun: env.DRY_RUN === "true",
  });
  await notifyDeactivated(env);
}

/**
 * ACTIVATING のまま止まった状態を回復する。
 * D1 は信用できないので、Cloudflare 側の実際のルール状態に合わせる。
 */
async function recoverActivating(db, env, state, now) {
  console.warn("[DDOS-GUARD] ACTIVATING timeout detected. Recovering...");
  const wafEnabled = await fetchCurrentWafRuleStatus(env);

  if (wafEnabled === true) {
    const scheduledDisableAt = now + state.protectionDuration;
    await db.prepare(
      "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', under_attack_enabled_at = ?, scheduled_disable_at = ?, updated_at = ? WHERE state_key = 'global'"
    ).bind(now, scheduledDisableAt, now).run();
    console.log("[DDOS-GUARD] ACTIVATING recovery: CF is active. State moved to UNDER_ATTACK");
    await recordDdosAudit(db, "recover", "UNDER_ATTACK", { from: "ACTIVATING", wafEnabled: true, scheduledDisableAt });
  } else {
    const cooldownUntil = now + COOLDOWN_AFTER_API_FAILURE_MS;
    await db.prepare(
      "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, updated_at = ? WHERE state_key = 'global'"
    ).bind(cooldownUntil, now).run();
    console.log("[DDOS-GUARD] ACTIVATING recovery: CF is inactive. State moved to COOLDOWN");
    await recordDdosAudit(db, "recover", "COOLDOWN", { from: "ACTIVATING", wafEnabled, cooldownUntil });
  }

  invalidateDdosState();
}

/** DEACTIVATING のまま止まった状態を、Cloudflare 側の実状態に合わせて回復する */
async function recoverDeactivating(db, env, now) {
  console.warn("[DDOS-GUARD] DEACTIVATING timeout detected. Recovering...");
  const wafEnabled = await fetchCurrentWafRuleStatus(env);

  if (wafEnabled === false) {
    const cooldownUntil = now + COOLDOWN_AFTER_DEACTIVATE_MS;
    await db.prepare(
      "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
    ).bind(cooldownUntil, now, now).run();
    console.log("[DDOS-GUARD] DEACTIVATING recovery: CF is inactive. State moved to COOLDOWN");
    await recordDdosAudit(db, "recover", "COOLDOWN", { from: "DEACTIVATING", wafEnabled: false, cooldownUntil });
  } else {
    await db.prepare(
      "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', updated_at = ? WHERE state_key = 'global'"
    ).bind(now).run();
    console.log("[DDOS-GUARD] DEACTIVATING recovery: CF is active. Reverted state to UNDER_ATTACK");
    await recordDdosAudit(db, "recover", "UNDER_ATTACK", { from: "DEACTIVATING", wafEnabled });
  }

  invalidateDdosState();
}

/** COOLDOWN の期限が切れたら NORMAL へ戻す */
async function finishCooldown(db, now) {
  console.log("[DDOS-GUARD] Cooldown finished. Reverting state to NORMAL.");
  await db.prepare(
    "UPDATE ddos_state SET current_state = 'NORMAL', last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
  ).bind(now, now).run();
  invalidateDdosState();
}

/** 保持期間を過ぎた統計スライスを削除する */
async function cleanupOldSlices(db, now) {
  const deleteThreshold = Math.floor(now / 1000) - SLICE_RETENTION_SEC;
  const res = await db.prepare("DELETE FROM ddos_slices WHERE slice_time < ?").bind(deleteThreshold).run();
  if (res.meta.changes > 0) {
    console.log(`[DDOS-GUARD] Cleaned up ${res.meta.changes} old statistics slices`);
  }
}

/**
 * 定期実行されるDDoS防御の状態監視。
 * 期限切れの解除、途中で止まった遷移の回復、古い統計の掃除をまとめて行う。
 */
export async function handleDdosCron(env) {
  const now = Date.now();
  const db = env.DB;

  // Cron 全体を止めないよう、監視処理の例外はここで止める
  try {
    const state = await getDdosState(db);

    if (state.currentState === "UNDER_ATTACK" && now >= state.scheduledDisableAt) {
      await handleScheduledDisable(db, env, state, now);
    }
    if (state.currentState === "COOLDOWN" && now >= state.cooldownUntil) {
      await finishCooldown(db, now);
    }
    if (state.currentState === "ACTIVATING" && now - state.updatedAt >= TRANSITION_TIMEOUT_MS) {
      await recoverActivating(db, env, state, now);
    }
    if (state.currentState === "DEACTIVATING" && now - state.updatedAt >= TRANSITION_TIMEOUT_MS) {
      await recoverDeactivating(db, env, now);
    }

    await cleanupOldSlices(db, now);
  } catch (err) {
    console.error("[DDOS-GUARD] Error in handleDdosCron:", err);
  }
}
