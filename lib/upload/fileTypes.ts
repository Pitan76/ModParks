/**
 * アップロードで受け入れるファイル種別の定義。
 *
 * presign（署名付きURL発行）と direct（Worker 経由 PUT）の 2 経路があり、
 * 片方だけで検証していると、もう片方が素通り口になる。
 * 実際 direct 側には検証が無く、任意の Content-Type で
 * `mod/` 配下（= /api/r2 で自オリジンから公開される）へ書き込めていたため、
 * 定義をここに集約して両方から使う。
 */

export type UploadType = "icon" | "mod" | "avatar" | "media";

const ALLOWED_MOD_TYPES = [
  "application/java-archive",
  "application/x-java-archive",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** キーのプレフィックス（`mod/` など）から用途を逆算する */
export function uploadTypeFromKey(key: string): UploadType | null {
  const prefix = key.split("/")[0];
  if (prefix === "icon" || prefix === "mod" || prefix === "avatar" || prefix === "media") {
    return prefix;
  }
  return null;
}

/**
 * 用途に対して Content-Type / ファイル名が妥当かを判定する。
 *
 * mod は Content-Type が当てにならない（ブラウザが octet-stream を送る）ため
 * 拡張子でも判定するが、画像系は Content-Type をそのまま R2 に保存して
 * 配信時に返すことになるので、必ずホワイトリストに一致させる。
 */
export function isAllowedUpload(type: UploadType, contentType: string, fileName: string): boolean {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const name = fileName.toLowerCase();

  if (type === "mod") {
    const extOk = name.endsWith(".jar") || name.endsWith(".zip");
    return extOk && ALLOWED_MOD_TYPES.includes(normalized);
  }

  return ALLOWED_IMAGE_TYPES.includes(normalized);
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
