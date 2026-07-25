import React from "react";
import DescriptionSkeleton from "./skeletons/DescriptionSkeleton";

/**
 * サーバーサイドビルド時に重量級の MarkdownRendererInner を代替するためのダミーコンポーネント。
 * SSR 時にはスケルトンを表示するだけで、実際のマークダウンレンダリングはクライアントサイドでのみ行います。
 */
export default function MarkdownRendererEmpty() {
  return <DescriptionSkeleton />;
}
