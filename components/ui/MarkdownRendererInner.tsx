"use client";

import { createContext, useContext, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";
import ZoomableImage from "./ZoomableImage";
import { toProxiedImageUrl } from "@/lib/utils/imageProxy";

// リンク内の画像はクリックでリンク遷移させたいので、拡大表示を無効化するためのフラグ
const InsideLinkContext = createContext(false);

type MarkdownRendererInnerProps = {
  content: string;
};

/**
 * Markdown 内の画像。リンクの中にある場合のみ拡大せず通常の画像として描画します。
 */
const MarkdownImage = ({ src, alt }: { src?: string; alt?: string }) => {
  const insideLink = useContext(InsideLinkContext);
  if (!src) return null;
  // 外部画像は必ずプロキシ経由にする。閲覧者の IP / UA を画像ホストへ渡さないため
  const proxied = toProxiedImageUrl(src);
  // eslint-disable-next-line @next/next/no-img-element
  if (insideLink) return <img src={proxied} alt={alt || ""} referrerPolicy="no-referrer" />;
  return <ZoomableImage src={proxied} alt={alt} />;
};

/**
 * 実際の Markdown 描画本体。
 *
 * このモジュール自体が MarkdownRenderer 側の dynamic(ssr:false) 経由でしか読まれないため、
 * react-markdown / rehype / remark はここで静的 import してもサーバーバンドルには入らない。
 * かつて中でさらに動的 import していたが、それだと「Inner のチャンク取得 → 完了後に
 * ようやくパーサ4本の取得を開始」と往復が直列に積まれ、本文が出るまでスケルトンのまま
 * 待たされていたため、この段は畳んである。
 */
const MarkdownRendererInner = ({ content }: MarkdownRendererInnerProps) => {
  // iframe(YouTube 等の埋め込み)を許可するため sanitize schema を拡張。
  //
  // iframe の style は外しておく。position: fixed などで画面全体を覆えてしまい、
  // 自サイトのドメイン上で偽の UI を重ねる余地を与えるため。
  // src の行き先は CSP の frame-src(YouTube のみ)で更に制限している。
  //
  // なお img は、Markdown 記法でも rehype-raw 経由の生 <img> でも
  // components.img（= MarkdownImage）を通ることを確認済みのため、
  // プロキシ化を迂回される経路は無い。
  const SCHEMA = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), "iframe"],
    attributes: {
      ...defaultSchema.attributes,
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    },
  };

  return (
    <Box
      sx={{
        "& img": { maxWidth: "100%", height: "auto", borderRadius: 1 },
        "& pre": {
          bgcolor: "background.paper",
          p: 2,
          borderRadius: 1,
          overflowX: "auto",
          border: "1px solid",
          borderColor: "divider",
          maxWidth: "100%",
        },
        "& code": {
          bgcolor: "action.hover",
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          fontFamily: "monospace",
          fontSize: "0.875em",
          wordBreak: "break-all",
        },
        "& pre code": {
          bgcolor: "transparent",
          p: 0,
          border: "none",
          wordBreak: "normal",
        },
        "& table": {
          width: "100%",
          borderCollapse: "collapse",
          mb: 2,
          display: "block",
          overflowX: "auto",
        },
        "& th, & td": {
          border: "1px solid",
          borderColor: "divider",
          padding: 1,
        },
        "& th": {
          bgcolor: "action.hover",
        },
        "& blockquote": {
          borderLeft: "4px solid",
          borderColor: "primary.main",
          pl: 2,
          ml: 0,
          color: "text.secondary",
          bgcolor: "action.hover",
          py: 0.5,
          borderRadius: 1,
        },
        "& ul, & ol": {
          pl: 3,
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SCHEMA]]}
        components={{
          h1: ({ children }: { children?: ReactNode }) => <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold", mt: 4, mb: 2 }}>{children}</Typography>,
          h2: ({ children }: { children?: ReactNode }) => <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold", mt: 3, mb: 1.5, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>{children}</Typography>,
          h3: ({ children }: { children?: ReactNode }) => <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mt: 2, mb: 1 }}>{children}</Typography>,
          h4: ({ children }: { children?: ReactNode }) => <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>{children}</Typography>,
          p: ({ children }: { children?: ReactNode }) => <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2 }}>{children}</Typography>,
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <Link href={href} target="_blank" rel="noopener noreferrer">
              <InsideLinkContext.Provider value={true}>{children}</InsideLinkContext.Provider>
            </Link>
          ),
          img: ({ src, alt }: { src?: string; alt?: string }) => <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} />,
          li: ({ children }: { children?: ReactNode }) => (
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              {children}
            </Typography>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};

export default MarkdownRendererInner;
