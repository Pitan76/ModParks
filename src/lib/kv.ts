/**
 * Cloudflare KV ユーティリティ
 * アプリ設定 (app settings) の保存先として利用する KV バインディングを取得します。
 */

/**
 * KV バインディングを取得する。
 * 開発環境では Wrangler Proxy 経由、本番では CloudflareContext から取得する。
 */
export async function getSettingsKV(): Promise<KVNamespace> {
  let kv: KVNamespace;
  if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    const proxy = await getCachedPlatformProxy();
    kv = proxy.env.SETTINGS_KV as KVNamespace;
  } else {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    kv = (env as unknown as { SETTINGS_KV: KVNamespace }).SETTINGS_KV;
  }
  if (!kv) throw new Error("SETTINGS_KV binding not found");
  return kv;
}
