"use client";

import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

/**
 * 同意画面の本体を client 専用で遅延ロードする。
 * 設定画面と同じく、MUI を Worker バンドルから assets 側へ逃がすため。
 */
function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

export const ConsentFormLazy = dynamic(() => import("./ConsentForm"), { ssr: false, loading: Loading });
