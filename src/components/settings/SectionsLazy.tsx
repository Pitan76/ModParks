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

// next/dynamic の第2引数はオブジェクトリテラルでなければビルドが通らないため、
// 共通の設定を変数に括り出さずに各行へ展開している。
export const ProfileTabLazy = dynamic(() => import("./tabs/ProfileTab"), { ssr: false, loading: Loading });
export const AccountSectionLazy = dynamic(() => import("./AccountSection"), { ssr: false, loading: Loading });
export const ThemeTabLazy = dynamic(() => import("./tabs/ThemeTab"), { ssr: false, loading: Loading });
export const SecuritySectionLazy = dynamic(() => import("./SecuritySection"), { ssr: false, loading: Loading });
export const DeveloperTabsLazy = dynamic(() => import("./tabs/DeveloperTabs"), { ssr: false, loading: Loading });
export const PostingTabLazy = dynamic(() => import("./tabs/PostingTab"), { ssr: false, loading: Loading });
export const NotificationsTabLazy = dynamic(() => import("./tabs/NotificationsTab"), { ssr: false, loading: Loading });
export const IntegrationTabLazy = dynamic(() => import("./tabs/IntegrationTab"), { ssr: false, loading: Loading });
