import { DDOS_DEFAULTS, STATE_CACHE_TTL_MS } from "./ddos-config.js";

/** 全リクエストで D1 を読むと負荷が高いため、短時間だけ Isolate 内に持つ */
let cachedState = null;
let cachedStateTime = 0;

const SELECT_STATE_SQL =
  "SELECT current_state, attack_detected_at, under_attack_enabled_at, scheduled_disable_at, " +
  "cooldown_until, protection_duration, last_normal_at, updated_at " +
  "FROM ddos_state WHERE state_key = 'global'";

function toState(row) {
  return {
    currentState:         row.current_state,
    attackDetectedAt:     row.attack_detected_at,
    underAttackEnabledAt: row.under_attack_enabled_at,
    scheduledDisableAt:   row.scheduled_disable_at,
    cooldownUntil:        row.cooldown_until,
    protectionDuration:   row.protection_duration,
    lastNormalAt:         row.last_normal_at,
    updatedAt:            row.updated_at,
  };
}

/**
 * 現在の防護状態を返す。読めなかった場合は NORMAL 相当を返し、リクエスト処理は続行させる。
 */
export async function getDdosState(db) {
  const now = Date.now();
  if (cachedState && now - cachedStateTime < STATE_CACHE_TTL_MS) return cachedState;

  try {
    const row = await db.prepare(SELECT_STATE_SQL).first();
    if (row) {
      cachedState = toState(row);
      cachedStateTime = now;
      return cachedState;
    }
  } catch (err) {
    console.error("[DDOS-GUARD] Failed to get DdosState from D1:", err);
  }

  return { currentState: "NORMAL", lastNormalAt: 0, protectionDuration: DDOS_DEFAULTS.defaultDuration };
}

/** 状態を書き換えた直後に呼ぶ。次回の getDdosState で D1 を読み直させる */
export function invalidateDdosState() {
  cachedState = null;
}
