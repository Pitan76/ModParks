"use client";

import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MarkdownRenderer from "./MarkdownRenderer";
// @ts-ignore
import puki2md from "puki2md";

interface DescriptionRendererProps {
  content: string;
  format?: string | null;
}

export default function DescriptionRenderer({ content, format = "markdown" }: DescriptionRendererProps) {
  const renderedContent = useMemo(() => {
    if (format === "pukiwiki") {
      try {
        return puki2md(content);
      } catch (err) {
        console.error("PukiWiki to Markdown conversion failed:", err);
        return content; // Fallback
      }
    }
    return content;
  }, [content, format]);

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
}
