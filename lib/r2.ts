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

/** R2 にファイルをアップロードする */
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | Blob | string,
  contentType: string
): Promise<string> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
  return key;
}

/**
 * R2のキーから、公開アクセス用のURLを生成します。
 * 開発環境ではローカルのプロキシルート (`/api/r2/`) を返し、
 * 本番環境ではカスタムドメインやパブリックURLを返します。
 * @param key R2のオブジェクトキー
 * @returns 完全なURLまたは絶対パス文字列
 */
export function getR2PublicUrl(key: string): string {
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  // R2_PUBLIC_URL が設定されていない場合（ローカル開発時など）は、API経由でアクセス
  return `/api/r2/${key}`;
}

/** 
 * R2 からオブジェクトを削除する
 * @param bucket R2Bucket バインディング
 * @param key 削除するオブジェクトのキー
 */
export async function deleteFromR2(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

/**
 * 保存済みの fileUrl から R2 オブジェクトキーを逆算します。
 * 外部URL（GitHub / Modrinth / CurseForge 等）の場合は R2 上に実体が無いため null を返します。
 * @param fileUrl versions.fileUrl に保存された値
 * @returns R2キー、または R2 管理外なら null
 */
export function getR2KeyFromUrl(fileUrl: string): string | null {
  if (process.env.R2_PUBLIC_URL && fileUrl.startsWith(`${process.env.R2_PUBLIC_URL}/`)) {
    return fileUrl.slice(process.env.R2_PUBLIC_URL.length + 1);
  }
  // ローカル開発時などの API 経由パス
  if (fileUrl.startsWith("/api/r2/")) {
    return fileUrl.slice("/api/r2/".length);
  }
  return null;
}

/**
 * R2 に保存するオブジェクトのキー（パス）を構築します。
 * @param type 保存するファイルの種類 (avatar | mod | icon 等)
 * @param id プロジェクトSlugやユーザーIDなどの識別子
 * @param filename アップロードされたファイル名
 * @returns R2のキー文字列 (例: `avatar/userid/123456789_filename.png`)
 */
export function buildR2Key(
  type: "icon" | "mod" | "avatar",
  id: string,
  filename: string
): string {
  const timestamp = Date.now();
  return `${type}/${id}/${timestamp}/${filename}`;
}
