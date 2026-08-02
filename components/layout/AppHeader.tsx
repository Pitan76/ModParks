"use client";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useColorMode } from "@/components/ThemeRegistry";
import { useBorderColor } from "@/lib/hooks/useBorderColor";
import NotificationBell from "@/components/notification/NotificationBell";
import { useCartEnabled } from "@/components/cart/cartStore";
import { SIDEBAR_WIDTH } from "./BaseSidebar";
import HeaderBrand from "./header/HeaderBrand";
import NewProjectButton from "./header/NewProjectButton";
import HeaderCartButton from "./header/HeaderCartButton";
import LocaleSelect from "./header/LocaleSelect";
import UserMenu from "./header/UserMenu";
import AuthButtons from "./header/AuthButtons";
import type { Session } from "next-auth";

export type AppHeaderProps = {
  session: Session | null;
  onMenuClick?: () => void;
  collapsed?: boolean;
};

/**
 * アプリケーションの共通ヘッダーコンポーネント。
 * ロゴ、新規プロジェクト作成ボタン、通知ベル、カート、テーマ切り替え、言語切り替え、
 * およびユーザーのアバター（ログインメニュー）を配置する。
 */
const AppHeader = ({ session, onMenuClick, collapsed = false }: AppHeaderProps) => {
  const { mode, toggleColorMode } = useColorMode();
  const borderColor = useBorderColor();
  const cartEnabled = useCartEnabled();

  const user = session?.user ?? null;

  return (
    <AppBar
      position="sticky"
      id="app-header"
      sx={{ zIndex: (theme) => ({ xs: theme.zIndex.appBar, md: theme.zIndex.drawer + 1 }) }}
    >
      {/* サイドバー右端の縦線をヘッダーまで延長し、上端から連続して見せる */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${SIDEBAR_WIDTH - 1}px`,
          width: "1px",
          bgcolor: borderColor,
          display: { xs: "none", md: "block" },
          opacity: collapsed ? 0 : 1,
          transition: (theme) =>
            theme.transitions.create("opacity", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      />
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          id="menu-button"
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ display: { md: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        <HeaderBrand />

        <Box sx={{ flexGrow: 1 }} />

        {user && <NewProjectButton />}
        {user && <NotificationBell />}

        {cartEnabled && <HeaderCartButton userId={user?.id ?? null} />}

        {/* テーマと言語の切替は、ログイン時は設定画面に集約するのでここでは出さない */}
        {!user && (
          <Tooltip title={mode === "light" ? "Dark Mode" : "Light Mode"}>
            <IconButton
              onClick={toggleColorMode}
              color="inherit"
              size="small"
              sx={{ mr: 0.5, display: { xs: "none", md: "flex" } }}
            >
              {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        )}
        {!user && <LocaleSelect />}

        {user ? <UserMenu user={user} /> : <AuthButtons />}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
