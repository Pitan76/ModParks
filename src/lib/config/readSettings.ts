import { getSettingsKV } from "@/lib/kv";
import { readAppSettings } from "@modparks/core/config/readSettings";
import type { AppSettings } from "@modparks/core/config/appSettings";

/**
 * Next 側のアダプタ。読み出し本体は core にあり、ここは
 * アンビエントな KV バインディング取得を解決するだけ。
 */
export async function getAppSettings(): Promise<AppSettings> {
  return readAppSettings(await getSettingsKV());
}
