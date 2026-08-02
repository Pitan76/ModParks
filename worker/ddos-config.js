/** 攻撃判定のしきい値。KV に設定が無い場合はこの値を使う */
export const DDOS_DEFAULTS = {
  thresholdRequests: 1000,
  thresholdDownloadRatio: 0.8,
  thresholdTopSlugRatio: 0.75,
  thresholdIpRepeatRate: 5.0,
  defaultDuration: 600000,
};

/** 防護解除後の再発動抑制時間(ms) */
export const COOLDOWN_AFTER_DEACTIVATE_MS = 300000;

/** Cloudflare API 失敗時に、APIを叩き続けないために置く抑制時間(ms) */
export const COOLDOWN_AFTER_API_FAILURE_MS = 120000;

/** ACTIVATING / DEACTIVATING がこの時間を超えたら、途中で落ちたとみなして回復処理へ回す(ms) */
export const TRANSITION_TIMEOUT_MS = 60000;

/** 前回の復帰からこの時間内に再検知したら、防護時間をバックオフで倍にする(ms) */
export const BACKOFF_WINDOW_MS = 900000;

/** バックオフで延ばせる防護時間の上限(ms) */
export const MAX_PROTECTION_DURATION_MS = 3600000;

/** 統計スライスの粒度(ms)。この単位で集計してD1へ書き出す */
export const SLICE_BUCKET_MS = 10000;

/** 集計対象にする直近スライスの範囲(秒)。2スライス分 */
export const EVALUATION_WINDOW_SEC = 10;

/** 統計スライスを保持する期間(秒) */
export const SLICE_RETENTION_SEC = 1800;

/** D1 から読んだ状態をこの時間だけメモリに保持する(ms) */
export const STATE_CACHE_TTL_MS = 5000;

/**
 * KV から動的なしきい値設定を読む。
 * 設定は管理画面から更新されるため、Worker のデプロイなしに変えられるようにしている。
 */
export async function getDdosConfig(env) {
  try {
    const raw = await env.SETTINGS_KV.get("app:settings", "json");
    return {
      thresholdRequests:      raw?.ddosThresholdRequests ?? DDOS_DEFAULTS.thresholdRequests,
      thresholdDownloadRatio: raw?.ddosThresholdDownloadRatio ?? DDOS_DEFAULTS.thresholdDownloadRatio,
      thresholdTopSlugRatio:  raw?.ddosThresholdTopSlugRatio ?? DDOS_DEFAULTS.thresholdTopSlugRatio,
      thresholdIpRepeatRate:  raw?.ddosThresholdIpRepeatRate ?? DDOS_DEFAULTS.thresholdIpRepeatRate,
      defaultDuration:        raw?.ddosDefaultProtectionDuration ?? DDOS_DEFAULTS.defaultDuration,
    };
  } catch (e) {
    console.error("[DDOS-GUARD] Failed to read app settings from KV:", e);
    return { ...DDOS_DEFAULTS };
  }
}
