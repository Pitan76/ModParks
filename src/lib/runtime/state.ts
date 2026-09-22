/**
 * 運用設定の読み書き（Next 側のアダプタ）。
 *
 * 本体は core/runtime/config.ts にあり、ここは KV バインディングを
 * アンビエントに解決して渡すだけ。
 */
import { getSettingsKV } from "@/lib/kv";
import { readRuntimeConfig, writeRuntimeConfig, RUNTIME_KEY } from "@modparks/core/runtime/config";
import { DEFAULT_RUNTIME_CONFIG, type RuntimeConfig } from "@modparks/core/runtime/features";

export { RUNTIME_KEY };

/**
 * 運用設定を取得する。読めなかった場合は「全機能が有効」を返す。
 *
 * KV バインディングの取得自体が失敗した場合も既定値に倒す（移設前と同じ）。
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  // バインディングの取得は外部I/O境界。失敗しても既定値で処理を続ける
  let kv: KVNamespace;
  try {
    kv = await getSettingsKV();
  } catch (err) {
    console.error("[RUNTIME] Failed to read runtime config:", err);
    return DEFAULT_RUNTIME_CONFIG;
  }

  return readRuntimeConfig(kv);
}

/** 運用設定を保存する。書き込み後は次の読み取りで KV を引き直させる */
export async function putRuntimeConfig(config: RuntimeConfig): Promise<void> {
  await writeRuntimeConfig(await getSettingsKV(), config);
}
