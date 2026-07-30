"use client";

import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

/**
 * 設定画面の各セクションを client 専用（ssr:false）で遅延ロードする。
 *
 * 設定画面は認証必須で SEO も不要なため、ここで抱える MUI を
 * Worker バンドルから assets 側へ逃がす。サーバーページから直接
 * import すると Worker のサイズ上限を圧迫するので、必ずここを経由する。
 */
function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

const lazyOptions = { ssr: false as const, loading: Loading };

export const ProfileTabLazy = dynamic(() => import("./tabs/ProfileTab"), lazyOptions);
export const AccountSectionLazy = dynamic(() => import("./AccountSection"), lazyOptions);
export const ThemeTabLazy = dynamic(() => import("./tabs/ThemeTab"), lazyOptions);
export const SecuritySectionLazy = dynamic(() => import("./SecuritySection"), lazyOptions);
export const ApiKeysTabLazy = dynamic(() => import("./tabs/ApiKeysTab"), lazyOptions);
export const PostingTabLazy = dynamic(() => import("./tabs/PostingTab"), lazyOptions);
export const NotificationsTabLazy = dynamic(() => import("./tabs/NotificationsTab"), lazyOptions);
export const IntegrationTabLazy = dynamic(() => import("./tabs/IntegrationTab"), lazyOptions);
