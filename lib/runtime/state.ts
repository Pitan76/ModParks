/**
 * 運用設定の読み書き。
 *
 * アプリ設定 (`app:settings`) とはキーを分ける。
 * 判定のたびに読むため参照頻度が高く、キャッシュの寿命を独立させたいため。
 */
import { getSettingsKV } from "@/lib/kv";
import { DEFAULT_RUNTIME_CONFIG, type RuntimeConfig } from "@/lib/runtime/features";

export const RUNTIME_KEY = "app:runtime";

/**
 * Isolate 内キャッシュの寿命(ms)。
 * 毎リクエスト KV を読むと課金と遅延が乗るため、既存の DDoS 状態と同じ流儀で短く持つ。
 */
const CACHE_TTL_MS = 5000;

let cached: RuntimeConfig | null = null;
let cachedAt = 0;

/**
 * 運用設定を取得する。
 *
 * 読めなかった場合は「全機能が有効」を返す。
 * 設定が読めないことを理由にサイトを止める方が害が大きいため。
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  // KV は外部I/O境界。失敗しても既定値で処理を続ける
  try {
    const kv = await getSettingsKV();
    const raw = await kv.get<RuntimeConfig>(RUNTIME_KEY, "json");
    cached = raw ?? DEFAULT_RUNTIME_CONFIG;
  } catch (err) {
    console.error("[RUNTIME] Failed to read runtime config:", err);
    cached = DEFAULT_RUNTIME_CONFIG;
  }

  cachedAt = now;
  return cached;
}

/** 運用設定を保存する。書き込み後は次の読み取りで KV を引き直させる */
export async function putRuntimeConfig(config: RuntimeConfig): Promise<void> {
  const kv = await getSettingsKV();
  await kv.put(RUNTIME_KEY, JSON.stringify(config));

  cached = null;
  cachedAt = 0;
}
