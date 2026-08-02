/**
 * アップロードで受け入れるファイル種別の定義。
 *
 * presign（署名付きURL発行）と direct（Worker 経由 PUT）の 2 経路があり、
 * 片方だけで検証していると、もう片方が素通り口になる。
 * 実際 direct 側には検証が無く、任意の Content-Type で
 * `mod/` 配下（= /api/r2 で自オリジンから公開される）へ書き込めていたため、
 * 定義をここに集約して両方から使う。
 */

export const UPLOAD_TYPES = ["icon", "mod", "avatar", "media"] as const;

export type UploadType = (typeof UPLOAD_TYPES)[number];

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** アップロード 1 件あたりの上限バイト数（presign / direct の両経路で共有する） */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * 外から来た値が UploadType かを実行時に判定する。
 *
 * presign はリクエストボディの `type` をそのまま R2 キーの先頭に埋め込むため、
 * 型アサーションだけだと `type: "../evil"` のような値で
 * バケットの任意プレフィックスへ書き込める。必ずこの関数を通す。
 */
export function isUploadType(value: unknown): value is UploadType {
  return typeof value === "string" && (UPLOAD_TYPES as readonly string[]).includes(value);
}

/** キーのプレフィックス（`mod/` など）から用途を逆算する */
export function uploadTypeFromKey(key: string): UploadType | null {
  const prefix = key.split("/")[0];
  return isUploadType(prefix) ? prefix : null;
}

/**
 * 用途に対して Content-Type / ファイル名が妥当かを判定する。
 *
 * mod は Content-Type が環境依存で当てにならない。ブラウザは OS の登録情報を
 * そのまま返すため、例えば Amazon Corretto が入った Windows では .jar が
 * `application/jar` になるなど、ホワイトリストで列挙しきれない。
 * 保存した Content-Type は配信時に使わず（safeContentTypeForKey 参照）
 * 必ず octet-stream + attachment で返すので、拡張子だけで判定する。
 * 画像系は Content-Type をそのまま配信で返すため、引き続き厳密に照合する。
 *
 * 種別ごとに switch で網羅する。「mod 以外は画像」のフォールスルーにすると、
 * UploadType に種別を足した瞬間に黙って画像ルールが適用されてしまう。
 */
export function isAllowedUpload(type: UploadType, contentType: string, fileName: string): boolean {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const name = fileName.toLowerCase();

  switch (type) {
    case "mod":
      return name.endsWith(".jar") || name.endsWith(".zip");
    case "icon":
    case "avatar":
    case "media":
      return ALLOWED_IMAGE_TYPES.includes(normalized);
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

/**
 * 配信時に返してよい Content-Type を、保存済みの値ではなく拡張子から導出する。
 *
 * アップローダーが指定した Content-Type をそのまま返すと、
 * `text/html` を保存するだけで自オリジン上の HTML として描画され、
 * CSP が `script-src 'unsafe-inline'` を許している以上そのままスクリプトが動く。
 * ここに載っていない拡張子は null を返し、呼び出し側で
 * `application/octet-stream` + `Content-Disposition: attachment` に落とす。
 */
const SAFE_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function safeContentTypeForKey(key: string): string | null {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return SAFE_CONTENT_TYPE_BY_EXT[ext] ?? null;
}
