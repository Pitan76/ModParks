"use client";

import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import MenuIcon from "@mui/icons-material/Menu";
import AddIcon from "@mui/icons-material/Add";
import LanguageIcon from "@mui/icons-material/Language";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import LinkMenuItem from "@/components/ui/LinkMenuItem";
import { useColorMode } from "@/components/ThemeRegistry";

import type { Session } from "next-auth";

interface AppHeaderProps {
  session: Session | null;
  onMenuClick?: () => void;
}

export default function AppHeader({ session, onMenuClick }: AppHeaderProps) {
  const t        = useTranslations("Nav");
  const locale   = useLocale();
  const pathname = usePathname();
  const router   = useRouter();
  const { mode, toggleColorMode } = useColorMode();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleAvatarClick = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <AppBar position="sticky" id="app-header">
      <Toolbar sx={{ gap: 1 }}>
        {/* ハンバーガーメニュー（モバイル） */}
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

        {/* ロゴ (モバイルでのみ表示、デスクトップはサイドバーに表示) */}
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
            <Box
              component="img"
              src="/icon.svg"
              alt="ModParks Logo"
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                objectFit: "cover"
              }}
            />
            <Typography
              variant="h6"
              component="span"
              sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: "#f8fafc" }}
            >
              ModParks
            </Typography>
          </Box>
        </Link>

        {/* スペーサー */}
        <Box sx={{ flexGrow: 1 }} />

        {/* デスクトップナビ（アクションのみ） */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, alignItems: "center" }} />

        {/* 新規プロジェクトボタン (全画面・未ログインでも表示) */}
        <LinkButton
          href="/projects/new"
          id="nav-new-project-desktop"
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          sx={{ ml: 1, display: { xs: "none", sm: "flex" } }}
        >
          <Box component="span" sx={{ mt: "1px" }}>
            {t("newProject")}
          </Box>
        </LinkButton>

        {/* スマホ向け: 正方形のアイコンボタン */}
        <Box sx={{ display: { xs: "flex", sm: "none" }, ml: 0 }}>
          <Link href="/projects/new" style={{ display: "flex", textDecoration: "none" }} id="nav-new-project-mobile">
            <IconButton
              size="small"
              sx={{ 
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": { bgcolor: "primary.dark" },
                borderRadius: 1,
                p: "6px"
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Link>
        </Box>

        {/* テーマ切替 */}
        <Tooltip title={mode === "light" ? "Dark Mode" : "Light Mode"}>
          <IconButton onClick={toggleColorMode} color="inherit" size="small" sx={{ mr: 0.5 }}>
            {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Tooltip>

        {/* 言語切替 */}
        <Tooltip title="Language">
          <Select
            id="locale-select"
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            size="small"
            variant="outlined"
            renderValue={(v) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <LanguageIcon fontSize="small" />
                <Typography variant="body2" sx={{ mt: "1px" }}>
                  {v.toUpperCase()}
                </Typography>
              </Box>
            )}
            sx={{
              color:        "text.secondary",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
              ".MuiSelect-icon": { color: "text.secondary" },
            }}
          >
            <MenuItem value="ja">🇯🇵 日本語</MenuItem>
            <MenuItem value="en">🇺🇸 English</MenuItem>
          </Select>
        </Tooltip>

        {/* ログイン / アバター */}
        {session?.user ? (
          <>
            <Tooltip title={session.user.displayName ?? session.user.name ?? ""}>
              <IconButton
                id="user-avatar-button"
                onClick={handleAvatarClick}
                size="small"
              >
                <Avatar
                  src={session.user.avatarUrl ?? session.user.image ?? undefined}
                  alt={session.user.displayName ?? ""}
                  sx={{ width: 32, height: 32 }}
                />
              </IconButton>
            </Tooltip>

            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <LinkMenuItem
                href={`/profile/${session.user.username}`}
                onClick={handleMenuClose}
                id="user-menu-profile"
              >
                {t("profile")}
              </LinkMenuItem>
              <LinkMenuItem
                href="/projects?author=me"
                onClick={handleMenuClose}
                id="user-menu-my-projects"
              >
                {t("myProjects")}
              </LinkMenuItem>
              <MenuItem
                component={Link}
                href="/settings"
                onClick={handleMenuClose}
                sx={{ px: 2, py: 1.5 }}
              >
                {t("settings")}
              </MenuItem>
              {session.user.role === "admin" && (
                <LinkMenuItem
                  href="/admin"
                  onClick={handleMenuClose}
                  id="user-menu-admin"
                >
                  {t("admin")}
                </LinkMenuItem>
              )}
              <Divider />
              <MenuItem
                component="a"
                href="/api/auth/signout"
                onClick={handleMenuClose}
                id="user-menu-signout"
              >
                {t("logout")}
              </MenuItem>
            </Menu>
          </>
        ) : (
          <LinkButton
            id="login-button"
            href="/login"
            variant="outlined"
            size="small"
            sx={{
              borderColor: "primary.main",
              color:        "primary.main",
              "&:hover": {
                background:   "rgba(56,189,248,0.08)",
                borderColor:  "primary.light",
              },
            }}
          >
            <Box component="span" sx={{ mt: "1px" }}>
              {t("login")}
            </Box>
          </LinkButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
