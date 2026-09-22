/**
 * R2 のキー・公開URLの変換と、バインディングを受け取る操作。
 *
 * 環境に触れない純粋な部分だけを置く。公開URL（R2_PUBLIC_URL）は引数で受け取る。
 * modparks-api では実行時の変数が process.env に入る保証が無い（互換日付が古いため）。
 * バケットの取得（getR2Bucket）は環境依存なので Next 側の lib/r2.ts に残す。
 */

/** R2 にファイルをアップロードする */
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | Blob | string,
  contentType: string
): Promise<string> {
  await bucket.put(key, body, { httpMetadata: { contentType } });

  return key;
}

/** R2 からオブジェクトを削除する */
export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

/**
 * R2のキーから、公開アクセス用のURLを生成します。
 * 公開URLが未設定（ローカル開発時など）ならローカルのプロキシルート (`/api/r2/`) を返す。
 * @param publicUrl R2_PUBLIC_URL。未設定なら undefined
 * @param key R2のオブジェクトキー
 */
export function r2PublicUrl(publicUrl: string | undefined, key: string): string {
  if (publicUrl) return `${publicUrl}/${key}`;

  return `/api/r2/${key}`;
}

/**
 * R2 のキーとして使用するプレフィックス一覧。
 * buildR2Key() で生成されるキーは必ずこのいずれかで始まる。
 */
export const R2_KEY_PREFIXES = ["mod/", "icon/", "avatar/", "media/"] as const;

/**
 * 保存済みの fileUrl から R2 オブジェクトキーを逆算します。
 * 外部URL（GitHub / Modrinth / CurseForge 等）の場合は R2 上に実体が無いため null を返します。
 * @param publicUrl R2_PUBLIC_URL。未設定なら undefined
 * @param fileUrl versions.fileUrl に保存された値
 * @returns R2キー、または R2 管理外なら null
 */
export function r2KeyFromUrl(publicUrl: string | undefined, fileUrl: string): string | null {
  // 1. R2_PUBLIC_URL が設定されている場合は prefix マッチ
  if (publicUrl && fileUrl.startsWith(`${publicUrl}/`)) return fileUrl.slice(publicUrl.length + 1);
  // 2. ローカル開発時などの API 経由パス
  if (fileUrl.startsWith("/api/r2/")) {
    return fileUrl.slice("/api/r2/".length);
  }
  // 3. フォールバック: R2_PUBLIC_URL が Workers 環境で取得できない場合でも、
  //    URL のパス部分が R2 キープレフィックスで始まるなら R2 管理ファイルと判定する。
  //    外部URL（github.com, modrinth.com 等）のパスが mod/ や icon/ で始まることは
  //    事実上ないため、安全に判定できる。
  if (fileUrl.startsWith("http")) {
    try {
      const pathname = new URL(fileUrl).pathname;
      // パスの先頭 "/" を除去
      const pathWithoutSlash = pathname.startsWith("/") ? pathname.slice(1) : pathname;
      for (const prefix of R2_KEY_PREFIXES) {
        if (pathWithoutSlash.startsWith(prefix)) {
          return pathWithoutSlash;
        }
      }
    } catch {
      // URL パース失敗時は外部URLではないと判断して null
    }
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
  type: "icon" | "mod" | "avatar" | "media",
  id: string,
  filename: string
): string {
  const timestamp = Date.now();
  return `${type}/${id}/${timestamp}/${filename}`;
}
