"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// プロフィール編集は認証必須で SEO 不要のため、サーバーバンドルから外す
// client 専用の遅延ロードラッパー（ssr:false）。MUI を Worker から assets 側へ移す。
const ProfileForm = dynamic(() => import("./ProfileForm"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  ),
});

type Props = ComponentProps<typeof import("./ProfileForm")["default"]>;

export default function ProfileFormLazy(props: Props) {
  return <ProfileForm {...props} />;
}
