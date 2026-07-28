import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Cloudflare Workers (Edge Runtime) 向け設定
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@mui/icons-material", "@mui/material"],
  },
  images: {
    // GitHub アバター & R2 ファイルを許可
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        // R2 カスタムドメイン（R2_PUBLIC_URL）
        protocol: "https",
        hostname: "files.modparks.pitan76.net",
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    config.resolve.symlinks = false;
    if (isServer) {
      // サーバー(Worker)バンドルにインライン source map を焼き込ませない。
      // Cloudflare Workers の 3 MiB 制限に対する肥大要因になるため明示的に無効化する。
      config.devtool = false;
      // サーバーサイド（Worker）ビルド時には、重量級マークダウンレンダラーを空のダミーコンポーネントに置換
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@/components/ui/MarkdownRendererInner": path.resolve(
          __dirname,
          "components/ui/MarkdownRendererEmpty.tsx"
        ),
      };
      // react-markdown 関連の依存パッケージ群をサーバービルドから完全に排除（空モジュール化）
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(react-markdown|rehype-raw|rehype-sanitize|remark-gfm|micromark|mdast-util-to-hast|unist-util-visit|vfile)/,
        })
      );
    }
    return config;
  },
  async headers() {
    // MUI(emotion)のinline styleとNext.jsのinline scriptを壊さないため、
    // script/styleは 'unsafe-inline' を許容した最低限のCSPに留める
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      // 投稿本文の外部画像は /api/image-proxy 経由（= 'self'）で読み込むため、
      // img-src を https: 全体に開けておく必要はない。
      // 開けたままだと、プロキシを通さない経路が生まれたときに
      // 画像ホストへ閲覧者の IP / UA が渡ってしまう。
      //
      // ここに挙げるのは「プロキシを通さず直接 <img src> に入る配信元」:
      //   - 自前ストレージ (R2)
      //   - プロフィールのアバター (GitHub / Gravatar など)
      //   - プロジェクトアイコン (Modrinth / CurseForge からのインポート)
      //   - 利用者が指定しがちな一般的な画像ホスト
      // 本文中の画像はここに無いホストでもプロキシ経由で表示できる。
      [
        "img-src 'self' data: blob:",
        // 自前ストレージ
        "https://*.r2.dev",
        "https://files.modparks.pitan76.net",
        // アバター
        "https://avatars.githubusercontent.com",
        "https://*.githubusercontent.com",
        "https://secure.gravatar.com",
        "https://cdn.discordapp.com",
        // Mod 配布プラットフォーム由来のアイコン
        "https://cdn.modrinth.com",
        "https://media.forgecdn.net",
        "https://*.curseforge.com",
        "https://*.modrinth.com",
        "https://*.forgecdn.net",

        // Minecraft
        "https://*.minecraft.net",
        "https://*.mojang.com",

        // Forge
        "https://*.minecraftforge.net",

        // NeoForge
        "https://*.neoforged.net",

        // FabricMC
        "https://*.fabricmc.net",
        
        // QuiltMC
        "https://*.quiltmc.org",
        
        // 一般的な画像ホスティング / バッジ
        "https://i.imgur.com",
        "https://imgur.com",
        "https://img.shields.io",
        "https://raw.githubusercontent.com",
        "https://user-images.githubusercontent.com",
        "https://*.github.io",
        "https://github.com",
      ].join(" "),
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
