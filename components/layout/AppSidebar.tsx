"use client";

import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import FolderIcon from "@mui/icons-material/Folder";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import LanguageIcon from "@mui/icons-material/Language";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useColorMode } from "@/components/ThemeRegistry";

export const SIDEBAR_WIDTH = 260;

/**
 * サイドバーのナビゲーションアイテムが選択状態かどうかを判定する。
 * "projects" と "myProjects" はパスが同じ /projects なので、クエリパラメータで区別する。
 */
function getIsSelected(itemId: string, itemPath: string, pathname: string, isMyProjects: boolean): boolean {
  if (itemId === "projects") return pathname === "/projects" && !isMyProjects;
  if (itemId === "myProjects") return pathname === "/projects" && isMyProjects;
  return pathname === itemPath;
}

import type { Session } from "next-auth";

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  session: Session | null;
}

export default function AppSidebar({ mobileOpen, onMobileClose, session }: AppSidebarProps) {
  const t = useTranslations("Nav");
  const tAdmin = useTranslations("Admin");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMyProjects = searchParams?.get("author") === "me";
  const { mode, toggleColorMode } = useColorMode();
  const locale = useLocale();

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    onMobileClose(); // モバイル時はメニューを閉じる
  };

  const isAdminPage = pathname.includes("/admin");

  let navItems: any[] = [];

  if (isAdminPage && session?.user?.role === "admin") {
    navItems = [
      { id: "admin-home", label: tAdmin("sidebar.dashboard"), path: "/admin", icon: <DashboardIcon /> },
      { id: "admin-users", label: tAdmin("sidebar.users"), path: "/admin/users", icon: <PeopleIcon /> },
      { id: "admin-reports", label: tAdmin("sidebar.reports"), path: "/admin/reports", icon: <ReportIcon /> },
      { id: "admin-config", label: tAdmin("sidebar.config"), path: "/admin/config", icon: <SettingsIcon /> },
    ];
  } else {
    navItems = [
      { id: "home", label: t("home"), path: "/", icon: <HomeIcon /> },
      { id: "projects", label: t("projects"), path: "/projects", icon: <SearchIcon /> },
      { id: "ideas", label: t("ideas"), path: "/ideas", icon: <LightbulbIcon /> },
    ];

    if (session?.user) {
      navItems.push({ label: t("myProjects"), path: "/projects?author=me", id: "myProjects", icon: <FolderIcon /> });
      navItems.push({ label: t("profile"), path: `/profile/${session.user.username}`, id: "profile", icon: <AccountCircleIcon /> });
    }
  }

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
          {/* ロゴやタイトル */}
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
          <Box sx={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.5px" }}>
            ModParks
          </Box>
        </Link>
      </Box>
      <Divider />
      <List sx={{ px: 1, py: 2 }}>
        {navItems.map((item) => {
          const isSelected = getIsSelected(item.id, item.path, pathname, isMyProjects);

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isSelected}
                sx={{
                  borderRadius: 1,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    "& .MuiListItemIcon-root": {
                      color: "primary.contrastText",
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: pathname === item.path ? "inherit" : "text.secondary" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography sx={{ fontWeight: isSelected ? 700 : 500 }}>
                      {item.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* ─── Bottom Section (Theme, Locale, Auth) - Mobile Only ─── */}
      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column" }}>
        <Divider />
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Theme & Locale */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Select
              id="locale-select-sidebar"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              size="small"
              variant="outlined"
              renderValue={(v) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <LanguageIcon fontSize="small" />
                  <Typography variant="body2" sx={{ mt: "1px", fontWeight: 500 }}>
                    {v.toUpperCase()}
                  </Typography>
                </Box>
              )}
              sx={{
                flexGrow: 1,
                color: "text.secondary",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "text.secondary" },
                ".MuiSelect-icon": { color: "text.secondary" },
              }}
            >
              <MenuItem value="ja">🇯🇵 日本語</MenuItem>
              <MenuItem value="en">🇺🇸 English</MenuItem>
            </Select>

            <IconButton onClick={toggleColorMode} color="inherit" size="small" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: "6px" }}>
              {mode === "light" ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
      return (
      <Box component="nav" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
        {/* モバイル用ドロワー */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: SIDEBAR_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* デスクトップ用ドロワー */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>
      );
}
