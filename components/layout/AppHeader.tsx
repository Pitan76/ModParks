"use client";

import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
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
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import LinkMenuItem from "@/components/ui/LinkMenuItem";

interface Session {
  user?: {
    name?:        string | null;
    email?:       string | null;
    image?:       string | null;
    username?:    string;
    displayName?: string;
    avatarUrl?:   string;
    role?:        string;
  };
}

interface AppHeaderProps {
  session: Session | null;
  onMenuClick?: () => void;
}

export default function AppHeader({ session, onMenuClick }: AppHeaderProps) {
  const t        = useTranslations("Nav");
  const locale   = useLocale();
  const pathname = usePathname();
  const router   = useRouter();

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

        {/* ロゴ */}
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width:        32,
                height:       32,
                borderRadius: "8px",
                background:   "linear-gradient(135deg, #38bdf8, #0284c7)",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                fontWeight:   900,
                fontSize:     "18px",
                color:        "#082f49",
              }}
            >
              M
            </Box>
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

        {/* デスクトップナビ */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, alignItems: "center" }}>
          <LinkButton
            href="/projects"
            id="nav-projects"
            color="inherit"
            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
          >
            {t("projects")}
          </LinkButton>

          {session?.user && (
            <LinkButton
              href="/projects/new"
              id="nav-new-project"
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              sx={{ ml: 1 }}
            >
              {t("newProject")}
            </LinkButton>
          )}
        </Box>

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
                <Typography variant="body2">{v.toUpperCase()}</Typography>
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
                href="/profile"
                onClick={handleMenuClose}
                id="user-menu-profile"
              >
                {t("profile")}
              </LinkMenuItem>
              <LinkMenuItem
                href="/projects"
                onClick={handleMenuClose}
                id="user-menu-my-projects"
              >
                {t("myProjects")}
              </LinkMenuItem>
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
            {t("login")}
          </LinkButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
