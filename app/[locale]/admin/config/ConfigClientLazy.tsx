"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// admin UI をサーバーバンドルから外すための client 専用遅延ロードラッパー（ssr:false）。
const ConfigClient = dynamic(() => import("./ConfigClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./ConfigClient")["default"]>;

export default function ConfigClientLazy(props: Props) {
  return <ConfigClient {...props} />;
}
