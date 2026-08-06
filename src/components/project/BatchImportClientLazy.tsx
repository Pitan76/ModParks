"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// サーバーバンドル削減のため client 専用で遅延ロードする（ssr:false）。
// バッチインポート画面は認証背後・操作起点のUIで SEO 不要。
const BatchImportClient = dynamic(() => import("./BatchImportClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./BatchImportClient")["default"]>;

export default function BatchImportClientLazy(props: Props) {
  return <BatchImportClient {...props} />;
}
