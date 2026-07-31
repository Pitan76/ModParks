import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { CSP_IMG_SRC } from "./lib/config/imageHosts";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

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
    // 広告(AdSense)と計測(GA)の配信元。AdSense は本体スクリプトの他に
    // 入札・不正クリック検知(adtrafficquality)・広告表示用 iframe を別ホストから読むため、
    // script/frame/img をまとめてここで定義する。
    // ホストを個別列挙すると Google が配信元を増やしたときに広告が黙って止まるため、
    // サブドメインはワイルドカードで許可する。
    // script-src は既に 'unsafe-inline' / 'unsafe-eval' を許容しており XSS 防御としては
    // 機能していないので、ここを絞っても得られる安全性はほぼ無い。
    // 一方で取りこぼすと配信停止に直結するため、広く許可する側に倒している。
    // ワイルドカードは apex ドメインに一致しないので、両方を列挙すること。
    const adHosts = [
      "https://googlesyndication.com https://*.googlesyndication.com",
      "https://googleadservices.com https://*.googleadservices.com",
      "https://doubleclick.net https://*.doubleclick.net",
      "https://adtrafficquality.google https://*.adtrafficquality.google",
      "https://google-analytics.com https://*.google-analytics.com",
      "https://googletagmanager.com https://*.googletagmanager.com",
      // 広告配信・同意管理(Funding Choices)・広告用 iframe が google.com 直下にある
      "https://google.com https://*.google.com",
    ].join(" ");

    const csp = [
      "default-src 'self'",
      // gstatic はダッシュボードのグラフ (Google Charts) のローダーと、
      // ローダーが後から読む描画スクリプト・スタイルの配信元
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://www.gstatic.com ${adHosts}`,
      "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
      // 画像の配信元一覧は lib/config/imageHosts.ts に集約している。
      // プロキシ要否の判定（lib/utils/imageProxy.ts）と同じ定義を使うことで、
      // 「直接読み込むと判定したのに CSP に弾かれる」食い違いを防ぐ。
      // ここに無いホストの画像は /api/image-proxy 経由（= 'self'）で表示される。
      `${CSP_IMG_SRC} ${adHosts}`,
      "font-src 'self' data:",
      "connect-src 'self' https:",
      // 'self' はダウンロード処理が非表示 iframe で /api/download を開くために必要。
      // frame-src を明示すると default-src 'self' は継承されないので省略できない
      `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com ${adHosts}`,
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
