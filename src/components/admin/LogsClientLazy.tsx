"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// admin UI をサーバーバンドルから外すための client 専用遅延ロードラッパー（ssr:false）。
const LogsClient = dynamic(() => import("./LogsClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./LogsClient")["default"]>;

export default function LogsClientLazy(props: Props) {
  return <LogsClient {...props} />;
}
