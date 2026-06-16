"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
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
        },
        "& code": {
          bgcolor: "action.hover",
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          fontFamily: "monospace",
          fontSize: "0.875em",
        },
        "& pre code": {
          bgcolor: "transparent",
          p: 0,
          border: "none",
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
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold", mt: 4, mb: 2 }}>{children}</Typography>,
          h2: ({ children }) => <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold", mt: 3, mb: 1.5, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>{children}</Typography>,
          h3: ({ children }) => <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mt: 2, mb: 1 }}>{children}</Typography>,
          h4: ({ children }) => <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>{children}</Typography>,
          p: ({ children }) => <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2 }}>{children}</Typography>,
          a: ({ href, children }) => <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>,
          li: ({ children }) => (
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
}
