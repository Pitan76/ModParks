/**
 * 投稿本文に含まれる外部画像を、プロキシ経由の URL に書き換える。
 *
 * 閲覧者のブラウザが外部ホストへ直接アクセスすると、そのホストに
 * 閲覧者の IP アドレス・User-Agent・Referer が渡ってしまう。
 * `![](https://webhook.site/...)` のような受信確認サービスを本文に仕込むだけで
 * 閲覧者を追跡できるため、外部画像は必ずプロキシを通す。
 */

/** プロキシを通さずに直接読み込んでよいホスト（自サイト・自前のストレージ） */
function isOwnHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host.endsWith(".modparks.pitan76.net") || host === "modparks.pitan76.net") return true;
  // R2 の公開ドメイン（pub-xxxx.r2.dev / files.modparks...）
  if (host.endsWith(".r2.dev")) return true;
  return false;
}

/**
 * 画像 URL をプロキシ経由に変換する。
 * 相対パス・data URL・自サイトの画像はそのまま返す。
 */
export function toProxiedImageUrl(src: string): string {
  if (!src) return src;

  // 相対パスと data: はそのまま（外部へ出ないため）
  if (src.startsWith("/") || src.startsWith("data:")) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    // パースできないものは変換せず、そのまま描画側に委ねる
    return src;
  }

  // http は混在コンテンツとしてブラウザが弾くため、プロキシしても表示されない
  if (url.protocol !== "https:") return src;
  if (isOwnHost(url)) return src;

  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}
