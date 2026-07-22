"use client";

import dynamic from "next/dynamic";
import DescriptionSkeleton from "./skeletons/DescriptionSkeleton";

// react-markdown / rehype / remark を Worker(サーバー)バンドルから外すため、
// 描画本体は client 専用(ssr:false)で遅延ロードする。元々 SSR 時はスケルトンを
// 返す実装だったので、SSR 出力は変わらない。
const MarkdownRendererInner = dynamic(() => import("./MarkdownRendererInner"), {
  ssr: false,
  loading: () => <DescriptionSkeleton />,
});

type MarkdownRendererProps = {
  content: string;
};

/**
 * マークダウンテキストをHTMLにレンダリングするコンポーネント。
 * 重量級のマークダウンパース処理をクライアント側でのみ遅延ロード(ssr: false)して実行します。
 */
const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  return <MarkdownRendererInner content={content} />;
};

export default MarkdownRenderer;
