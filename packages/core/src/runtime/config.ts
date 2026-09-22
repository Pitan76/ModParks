import { DEFAULT_RUNTIME_CONFIG, effectiveMode, isFeatureEnabled, type RuntimeConfig, type RuntimeFeature } from "@modparks/core/runtime/features";

/**
 * 運用設定（機能スイッチ・運用モード）の読み書き。
 *
 * アプリ設定 (`app:settings`) とはキーを分ける。判定のたびに読むため参照頻度が高く、
 * キャッシュの寿命を独立させたいため。KV は引数で受け取る（Next は getSettingsKV、
 * modparks-api は env.SETTINGS_KV）。
 */
export const RUNTIME_KEY = "app:runtime";

/**
 * Isolate 内キャッシュの寿命(ms)。
 * 毎リクエスト KV を読むと課金と遅延が乗るため、既存の DDoS 状態と同じ流儀で短く持つ。
 * Next と modparks-api は別の isolate なので、それぞれが独立に持つ。
 */
const CACHE_TTL_MS = 5000;

let cached: RuntimeConfig | null = null;
let cachedAt = 0;

/**
 * 運用設定を取得する。
 *
 * 読めなかった場合は「全機能が有効」を返す。設定が読めないことを理由に
 * サイトを止める方が害が大きいため。
 */
export async function readRuntimeConfig(kv: KVNamespace): Promise<RuntimeConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  // KV は外部I/O境界。失敗しても既定値で処理を続ける
  try {
    cached = (await kv.get<RuntimeConfig>(RUNTIME_KEY, "json")) ?? DEFAULT_RUNTIME_CONFIG;
  } catch (err) {
    console.error("[RUNTIME] Failed to read runtime config:", err);
    cached = DEFAULT_RUNTIME_CONFIG;
  }

  cachedAt = now;
  return cached;
}

/** 運用設定を保存する。書き込み後は次の読み取りで KV を引き直させる */
export async function writeRuntimeConfig(kv: KVNamespace, config: RuntimeConfig): Promise<void> {
  await kv.put(RUNTIME_KEY, JSON.stringify(config));

  cached = null;
  cachedAt = 0;
}

/**
 * その機能を今使ってよいか。運用モードが NORMAL で、かつ機能が止められていないとき真。
 *
 * 判定は入口（Server Action・Route Handler・Hono のルート）でだけ行うこと。
 * 内部ロジックに持ち込むと、どこで止まるのかが追えなくなる。
 */
export function isFeatureAvailable(config: RuntimeConfig, feature: RuntimeFeature): boolean {
  return effectiveMode(config) === "NORMAL" && isFeatureEnabled(config, feature);
}
