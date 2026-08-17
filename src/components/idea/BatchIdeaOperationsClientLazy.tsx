"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// サーバーバンドル削減のため client 専用で遅延ロードする（ssr:false）。
const BatchIdeaOperationsClient = dynamic(() => import("./BatchIdeaOperationsClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./BatchIdeaOperationsClient")["default"]>;

export default function BatchIdeaOperationsClientLazy(props: Props) {
  return <BatchIdeaOperationsClient {...props} />;
}
