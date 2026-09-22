import { r2PublicUrl, r2KeyFromUrl } from "@modparks/core/r2";

/**
 * Cloudflare R2 ユーティリティ
 * Workers の R2 バインディングを使って署名付き URL を発行 / オブジェクトを操作する
 */

/**
 * R2 バケットのバインディングを取得する。
 * 開発環境では Wrangler Proxy 経由、本番では CloudflareContext から取得する。
 * サーバー側（Server Action / Route Handler）で R2 を直接操作する際に使用します。
 */
export async function getR2Bucket(): Promise<R2Bucket> {
  let bucket: R2Bucket;
  if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    const proxy = await getCachedPlatformProxy();
    bucket = proxy.env.modparks_storage;
  } else {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    bucket = (env as unknown as { modparks_storage: R2Bucket }).modparks_storage;
  }
  if (!bucket) throw new Error("R2 binding not found");
  return bucket;
}

export { uploadToR2, deleteFromR2, buildR2Key } from "@modparks/core/r2";

/**
 * R2のキーから、公開アクセス用のURLを生成します（Next 側）。
 * 本体は core/r2.ts。公開URLは process.env.R2_PUBLIC_URL から取る。
 */
export function getR2PublicUrl(key: string): string {
  return r2PublicUrl(process.env.R2_PUBLIC_URL, key);
}

/**
 * 保存済みの fileUrl から R2 オブジェクトキーを逆算します（Next 側）。
 * 外部URLの場合は R2 上に実体が無いため null を返します。本体は core/r2.ts。
 */
export function getR2KeyFromUrl(fileUrl: string): string | null {
  return r2KeyFromUrl(process.env.R2_PUBLIC_URL, fileUrl);
}
