"use client";

import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// サーバーバンドル削減のため admin UI は client 専用で遅延ロードする（ssr:false）。
// admin 画面は認証背後で SEO 不要なので、SSR しなくても支障がない。
const RecipeAdminClient = dynamic(() => import("./RecipeAdminClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

export default function RecipeAdminClientLazy() {
  return <RecipeAdminClient />;
}
