import { getSettingsKV } from "@/lib/kv";
import {
  SETTINGS_KEY,
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "@/lib/config/appSettings";

/**
 * KV からアプリ設定を読み出す。
 *
 * KV バインディングが無い / 読み取りに失敗した場合は既定値を返します。
 * 設定が読めないことでサイト全体が落ちるのを避けるための意図的な挙動です。
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const kv = await getSettingsKV();
    const raw = await kv.get(SETTINGS_KEY, "json");
    if (raw == null) return DEFAULT_APP_SETTINGS;
    return normalizeAppSettings(raw);
  } catch (error) {
    console.error("Failed to read app settings from KV, falling back to defaults:", error);
    return DEFAULT_APP_SETTINGS;
  }
}
