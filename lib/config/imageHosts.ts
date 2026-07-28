/**
 * 画像を直接読み込んでよいホストの一覧。
 *
 * ここが CSP (next.config.ts の img-src) と、プロキシ要否の判定
 * (lib/utils/imageProxy.ts) の唯一の定義元になる。
 *
 * 2 箇所で別々に持つと、CSP には無いホストを「直接読み込んでよい」と
 * 判定してしまい、画像が表示されない事故が起きる
 * （`*.modrinth.com` は `modrinth.com` に一致しない、など）。
 *
 * ここに載っているホストは閲覧者のブラウザが直接アクセスするため、
 * 相手側に閲覧者の IP / User-Agent が渡る。
 * 大手 CDN など、追跡目的で使われる恐れが低いものだけを載せること。
 * 載っていないホストの画像は /api/image-proxy 経由になり、
 * 外部からは Worker しか見えない。
 */
export const ALLOWED_IMAGE_HOSTS = [
  // 自サイト・自前ストレージ
  "*.pitan76.net",
  "pitan76.net",
  "*.wikichree.com",
  "wikichree.com",
  "*.civa.jp",
  "civa.jp",
  "*.r2.dev",
  "files.modparks.pitan76.net",

  // アバター
  "avatars.githubusercontent.com",
  "githubusercontent.com",
  "*.githubusercontent.com",
  "secure.gravatar.com",
  "cdn.discordapp.com",

  // Mod 配布プラットフォーム
  "modrinth.com",
  "cdn.modrinth.com",
  "*.modrinth.com",
  "curseforge.com",
  "*.curseforge.com",
  "media.forgecdn.net",
  "*.forgecdn.net",

  // Minecraft 関連
  "minecraft.net",
  "*.minecraft.net",
  "*.mojang.com",
  "minecraftforge.net",
  "*.minecraftforge.net",
  "neoforged.net",
  "*.neoforged.net",
  "fabricmc.net",
  "*.fabricmc.net",
  "quiltmc.org",
  "*.quiltmc.org",

  // 一般的な画像ホスティング / バッジ
  "i.imgur.com",
  "imgur.com",
  "img.shields.io",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
  "github.io",
  "*.github.io",
  "github.com",
] as const;

/**
 * ホスト名が直接読み込み許可の対象かを判定する。
 *
 * CSP と同じ規則で照合する。CSP の `*.example.com` は
 * `a.example.com` に一致するが `example.com` には一致しないため、
 * ここでも同様に扱う。判定がゆるいと CSP に弾かれて画像が消えるので、
 * 迷う場合は「許可しない」（＝プロキシ経由）に倒す。
 */
export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pattern;
  });
}

/** CSP の img-src ディレクティブ値 */
export const CSP_IMG_SRC = [
  "img-src 'self' data: blob:",
  ...ALLOWED_IMAGE_HOSTS.map((h) => `https://${h}`),
].join(" ");
