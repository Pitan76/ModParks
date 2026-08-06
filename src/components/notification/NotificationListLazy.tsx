"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// 通知一覧は認証必須で SEO 不要のため、サーバーバンドルから外す
// client 専用の遅延ロードラッパー（ssr:false）。MUI を Worker から assets 側へ移す。
const NotificationList = dynamic(() => import("./NotificationList"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./NotificationList")["default"]>;

export default function NotificationListLazy(props: Props) {
  return <NotificationList {...props} />;
}
