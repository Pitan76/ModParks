"use client";

import { useMemo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MarkdownRenderer from "./MarkdownRenderer";
import DescriptionSkeleton from "./skeletons/DescriptionSkeleton";
// @ts-ignore
import puki2md from "puki2md";

type DescriptionRendererProps = {
  content: string;
  format?: string | null;
};

/**
 * 形式（マークダウン、プレーンテキスト、PukiWiki）に応じて、適切なスタイルでテキストをレンダリングするコンポーネント。
 */
const DescriptionRenderer = ({ content, format = "markdown" }: DescriptionRendererProps) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const renderedContent = useMemo(() => {
    if (format === "pukiwiki") {
      try {
        return puki2md(content);
      } catch (err) {
        // 例外時のフォールバックとして元テキストを返すため try-catch を使用
        console.error("PukiWiki to Markdown conversion failed:", err);
        return content;
      }
    }
    return content;
  }, [content, format]);

  if (!mounted) return <DescriptionSkeleton />;

  if (format === "plaintext") {
    return (
      <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
        <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {content}
        </Typography>
      </Box>
    );
  }

  return <MarkdownRenderer content={renderedContent} />;
};

export default DescriptionRenderer;
