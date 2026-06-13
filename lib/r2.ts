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
  return `${type}/${id}/${timestamp}_${filename}`;
}
