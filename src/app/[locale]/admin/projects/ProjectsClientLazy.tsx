"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// admin UI をサーバーバンドルから外すための client 専用遅延ロードラッパー（ssr:false）。
const ProjectsClient = dynamic(() => import("./ProjectsClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./ProjectsClient")["default"]>;

export default function ProjectsClientLazy(props: Props) {
  return <ProjectsClient {...props} />;
}
