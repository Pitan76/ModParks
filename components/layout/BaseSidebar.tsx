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
import LanguageIcon from "@mui/icons-material/Language";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import { usePathname, useRouter, Link } from "@/lib/i18n/routing";
import { LOCALE_OPTIONS } from "@/lib/i18n/localeLabels";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useColorMode } from "@/components/ThemeRegistry";
import { useContextMenuHandler, useCommonItems, useContextMenuContext } from "@/components/ui/ContextMenu";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Badge from "@mui/material/Badge";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useCart, useCartEnabled } from "@/components/cart/cartStore";
import CartDrawer from "@/components/cart/CartDrawer";

export const SIDEBAR_WIDTH = 260;

export type NavItem = {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
};

export type BaseSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  navItems: NavItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const getIsSelected = (itemId: string, itemPath: string, pathname: string, isMyProjects: boolean): boolean => {
  if (itemId === "projects") return pathname === "/projects" && !isMyProjects;
  if (itemId === "myProjects") return pathname === "/projects" && isMyProjects;
  return pathname === itemPath;
};

/**
 * サイト全体の共通サイドバーコンポーネント。
 * デスクトップ表示（常時固定表示）とモバイル表示（ハンバーガーメニューからの一時Drawer表示）の双方に対応し、
 * ナビゲーションメニュー、言語切替、ダークモード切替などのコントロールを提供します。
 */
const BaseSidebar = ({ mobileOpen, onMobileClose, navItems, collapsed = false, onToggleCollapse }: BaseSidebarProps) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMyProjects = searchParams?.get("author") === "me";
  const { mode, toggleColorMode } = useColorMode();
  const locale = useLocale();
  const tMenu = useTranslations("ContextMenu");
  const tNav = useTranslations("Nav");
  const tCart = useTranslations("Cart");
  const openMenu = useContextMenuHandler();
  const { isDisabled } = useContextMenuContext();
  const c = useCommonItems();

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    onMobileClose();
  };

  // モバイルはヘッダーにカートを置かないので、サイドバーから開けるようにする
  const [cartOpen, setCartOpen] = useState(false);
  const { items: cartItems } = useCart();
  const cartEnabled = useCartEnabled();

  const handleCartClick = () => {
    onMobileClose();
    setCartOpen(true);
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* デスクトップはヘッダーにロゴを常設するため空スペーサー。モバイルはドロワーが前面に出るためロゴを表示 */}
      <Box sx={{ height: { xs: 56, sm: 64 }, px: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Link
          href="/"
          prefetch={false}
          onClick={onMobileClose}
          style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8 }}
        >
          <Box
            component="img"
            src="/icon.svg"
            alt="ModParks Logo"
            sx={{ display: { xs: "block", md: "none" }, width: 32, height: 32, borderRadius: "8px", objectFit: "cover" }}
          />
          <Box sx={{ display: { xs: "block", md: "none" }, fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.5px" }}>
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
                onContextMenu={(e) => {
                  openMenu(e, [
                    c.open(item.path, tMenu("open")),
                    c.openNewTab(item.path),
                    { type: "divider" },
                    c.copyLink(item.path),
                  ]);
                }}
                selected={isSelected}
                sx={{
                  WebkitTouchCallout: isDisabled ? "default" : "none",
                  borderRadius: 1,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root": { color: "primary.contrastText" },
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

        {/* カート（モバイルのみ。デスクトップはヘッダーに常設） */}
        {cartEnabled && (
        <ListItem disablePadding sx={{ mb: 0.5, display: { xs: "block", md: "none" } }}>
          <ListItemButton onClick={handleCartClick} sx={{ borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
              <Badge badgeContent={cartItems.length} color="primary">
                <ShoppingCartIcon />
              </Badge>
            </ListItemIcon>
            <ListItemText
              primary={<Typography sx={{ fontWeight: 500 }}>{tCart("title")}</Typography>}
            />
          </ListItemButton>
        </ListItem>
        )}
      </List>

      {/* ---- Collapse Button - Desktop Only ---- */}
      {onToggleCollapse && (
        <Box sx={{ display: { xs: "none", md: "flex" }, mt: "auto", p: 1, justifyContent: "flex-start" }}>
          <IconButton
            onClick={onToggleCollapse}
            size="small"
            aria-label={tNav("collapseSidebar")}
            sx={{ color: "text.secondary" }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* ---- Bottom Section (Theme, Locale) - Mobile Only ---- */}
      {!session?.user && (
      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", mt: "auto" }}>
        <Divider />
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Select
              id="locale-select-sidebar"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value as string)}
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
              {LOCALE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>

            <IconButton onClick={toggleColorMode} color="inherit" size="small" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: "6px" }}>
              {mode === "light" ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Box>
      )}
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{
        width: { md: collapsed ? 0 : SIDEBAR_WIDTH },
        flexShrink: { md: 0 },
        transition: (theme) =>
          theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: SIDEBAR_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            transform: collapsed ? `translateX(-${SIDEBAR_WIDTH}px)` : "none",
            transition: (theme) =>
              theme.transitions.create("transform", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
      {cartEnabled && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
    </Box>
  );
};

export default BaseSidebar;
