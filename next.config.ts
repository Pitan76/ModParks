import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { CSP_IMG_SRC } from "./lib/config/imageHosts";

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
      // 画像の配信元一覧は lib/config/imageHosts.ts に集約している。
      // プロキシ要否の判定（lib/utils/imageProxy.ts）と同じ定義を使うことで、
      // 「直接読み込むと判定したのに CSP に弾かれる」食い違いを防ぐ。
      // ここに無いホストの画像は /api/image-proxy 経由（= 'self'）で表示される。
      CSP_IMG_SRC,
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
