import { isAllowedImageHost } from "@/lib/config/imageHosts";

/**
 * 投稿本文などに含まれる外部画像を、必要に応じてプロキシ経由の URL に書き換える。
 *
 * 閲覧者のブラウザが外部ホストへ直接アクセスすると、そのホストに
 * 閲覧者の IP アドレス・User-Agent・Referer が渡ってしまう。
 * `![](https://webhook.site/...)` のような受信確認サービスを本文に仕込むだけで
 * 閲覧者を追跡できるため、素性の分からないホストはプロキシを通す。
 *
 * ただし GitHub や Modrinth などの大手 CDN まで全て中継すると
 * Worker の負荷と転送量が無駄に増えるため、
 * lib/config/imageHosts.ts の許可リストにあるホストは直接読み込む。
 * 許可リストは CSP (img-src) と共有しているので、
 * 「直接読み込むと判定したのに CSP に弾かれる」という食い違いは起きない。
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

  // 信頼できる配信元は中継せず直接読ませる（プロキシの負荷を避ける）
  if (isAllowedImageHost(url.hostname)) return src;

  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}
