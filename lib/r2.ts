/**
 * Cloudflare R2 ユーティリティ
 * Workers の R2 バインディングを使って署名付き URL を発行 / オブジェクトを操作する
 */

/** R2 にファイルをアップロードする */
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | Blob,
  contentType: string
): Promise<string> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
  return key;
}

/** R2 オブジェクトの公開 URL を生成（バケットがパブリックの場合）*/
export function getR2PublicUrl(key: string): string {
  const baseUrl =
    process.env.R2_PUBLIC_URL ?? "https://files.modparks.example.com";
  return `${baseUrl}/${key}`;
}

/** R2 からオブジェクトを削除する */
export async function deleteFromR2(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

/** ファイルキーを生成する */
export function buildR2Key(
  type: "icon" | "mod",
  projectSlug: string,
  fileName: string
): string {
  const timestamp = Date.now();
  return `${type}/${projectSlug}/${timestamp}_${fileName}`;
}
