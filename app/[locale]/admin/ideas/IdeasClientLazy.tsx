"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// admin UI をサーバーバンドルから外すための client 専用遅延ロードラッパー（ssr:false）。
const IdeasClient = dynamic(() => import("./IdeasClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./IdeasClient")["default"]>;

export default function IdeasClientLazy(props: Props) {
  return <IdeasClient {...props} />;
}
