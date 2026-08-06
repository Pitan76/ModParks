"use client";

import { useMemo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MarkdownRenderer from "./MarkdownRenderer";
import DescriptionSkeleton from "./skeletons/DescriptionSkeleton";
// @ts-expect-error - puki2md has no type declarations
import puki2md from "puki2md";
import { toPlainDescription } from "@/lib/utils/plainText";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const summaryText = useMemo(() => {
    const plain = toPlainDescription(renderedContent);
    return plain.length > 200 ? plain.substring(0, 200) + "..." : plain;
  }, [renderedContent]);

  if (!mounted) {
    if (!summaryText) return <DescriptionSkeleton />;
    return (
      <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary", lineHeight: 1.6 }}>
        {summaryText}
      </Typography>
    );
  }

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
