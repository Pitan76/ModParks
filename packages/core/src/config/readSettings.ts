import {
  SETTINGS_KEY,
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "@modparks/core/config/appSettings";

/**
 * KV からアプリ設定を読み出す。
 *
 * KV バインディングは引数で受け取る。Next 側は getCloudflareContext 経由、
 * Workers 側はハンドラの env から渡すこと。
 *
 * 読み取りに失敗した場合は既定値を返す。設定が読めないことでサイト全体が
 * 落ちるのを避けるための意図的な挙動。
 */
export async function readAppSettings(kv: KVNamespace): Promise<AppSettings> {
  // 外部I/O境界なので、ここで畳んで既定値へフォールバックする
  try {
    const raw = await kv.get(SETTINGS_KEY, "json");
    if (raw == null) return DEFAULT_APP_SETTINGS;

    return normalizeAppSettings(raw);
  } catch (error) {
    console.error("Failed to read app settings from KV, falling back to defaults:", error);
    return DEFAULT_APP_SETTINGS;
  }
}
