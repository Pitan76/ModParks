"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// サーバーバンドル削減のため client 専用で遅延ロードする（ssr:false）。
// 一括操作画面は認証背後・操作起点のUIで SEO 不要。
const BatchProjectOperationsClient = dynamic(() => import("./BatchProjectOperationsClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./BatchProjectOperationsClient")["default"]>;

export default function BatchProjectOperationsClientLazy(props: Props) {
  return <BatchProjectOperationsClient {...props} />;
}
