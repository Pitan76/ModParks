/**
 * Cloudflare Image Transformations (`/cdn-cgi/image/...`) 経由のサムネイル URL を組み立てる。
 *
 * 一覧ページはアイコンを数十枚並べるため、原寸のまま配信すると転送量が大きい。
 * 表示サイズに合わせて縮小し、`format=auto` で WebP/AVIF に変換させる。
 *
 * 課金は「その月に実際に要求された (画像, パラメータ) の種類数」で決まり、
 * アクセス数には比例しない。無料枠（月 5,000 変換）に収めるため、
 * 幅は ALLOWED_WIDTHS の固定値だけに制限している。
 * 呼び出し側が任意の数値を渡せると種類数が跳ね上がるので、型で塞ぐこと。
 */

/** 変換を許可する幅。増やすほど月あたりのユニーク変換数が増える */
export const ALLOWED_WIDTHS = [96, 128, 200, 400, 800] as const;

export type ImageWidth = (typeof ALLOWED_WIDTHS)[number];

/**
 * 変換の有効・無効。
 *
 * Cloudflare 側で Transformations を有効にしていないゾーンでは
 * `/cdn-cgi/image/` が 404 になり画像が消えるため、既定は無効。
 * 無料枠を超えた場合もここを "off" にすれば即座に原寸配信へ戻せる。
 */
const isEnabled = process.env.NEXT_PUBLIC_IMAGE_TRANSFORM === "on";

/** 自前ストレージの公開 URL。ここ配下の画像だけが変換対象 */
const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

/**
 * 画像 URL を指定幅のサムネイル URL に変換する。
 *
 * 変換が無効なとき、外部ホストの画像、開発時の `/api/r2/...` パスは
 * 元の URL をそのまま返す。外部ホストを変換対象にしないのは、
 * Cloudflare が既定では同一ゾーンの画像しか変換しないため。
 *
 * @param src 元の画像 URL（null/undefined 可）
 * @param options.w 表示幅（CSS ピクセル）
 * @returns 変換後 URL。src が空なら undefined
 */
export function imageUrl(
  src: string | null | undefined,
  options: { w: ImageWidth }
): string | undefined {
  if (!src) return undefined;
  if (!isEnabled || !publicBase) return src;
  if (!src.startsWith(`${publicBase}/`)) return src;

  const path = src.slice(publicBase.length + 1);
  // onerror=redirect は変換失敗時に元画像へリダイレクトさせる。
  // 無料枠（月5,000変換）を超えると変換はエラーを返すので、
  // これが無いと上限到達と同時に画像が壊れる。付けておけば原寸配信に落ちるだけで済む
  return `${publicBase}/cdn-cgi/image/width=${options.w},format=auto,quality=85,onerror=redirect/${path}`;
}
