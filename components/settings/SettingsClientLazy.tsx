"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// 設定画面は認証必須（未ログインは login へ redirect）で SEO 不要のため、
// サーバーバンドルから外す client 専用の遅延ロードラッパー（ssr:false）。
// これにより 8 個のタブ（Profile/Account/Security/ApiKeys/Posting/Integration/
// Notifications/Theme）が抱える MUI が Worker から assets 側へ移動する。
const SettingsClient = dynamic(() => import("./SettingsClient"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./SettingsClient")["default"]>;

export default function SettingsClientLazy(props: Props) {
  return <SettingsClient {...props} />;
}
