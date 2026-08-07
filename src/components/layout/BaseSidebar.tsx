"use client";

import Drawer from "@mui/material/Drawer";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { Link } from "@/lib/i18n/routing";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useCart, useCartEnabled } from "@/components/cart/cartStore";
import CartDrawer from "@/components/cart/CartDrawer";
import SidebarNavList from "./sidebar/SidebarNavList";
import SidebarBottomControls from "./sidebar/SidebarBottomControls";
import { SIDEBAR_WIDTH, type NavItem } from "./sidebar/navTypes";

export { SIDEBAR_WIDTH };
export type { NavItem };

export type BaseSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  navItems: NavItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  hideCart?: boolean;
};

/**
 * サイト全体の共通サイドバーコンポーネント。
 * デスクトップ表示（常時固定表示）とモバイル表示（ハンバーガーメニューからの一時Drawer表示）の双方に対応し、
 * ナビゲーションメニュー、言語切替、ダークモード切替などのコントロールを提供します。
 */
const BaseSidebar = ({
  mobileOpen,
  onMobileClose,
  navItems,
  collapsed = false,
  onToggleCollapse,
  hideCart = false,
}: BaseSidebarProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const tNav = useTranslations("Nav");
  const tCart = useTranslations("Cart");

  const handleNavigation = (path: string) => {
    router.push(path);
    onMobileClose();
  };

  // モバイルはヘッダーにカートを置かないので、サイドバーから開けるようにする
  const [cartOpen, setCartOpen] = useState(false);
  const { items: cartItems } = useCart();
  const cartEnabled = useCartEnabled() && !hideCart;

  const handleCartClick = () => {
    onMobileClose();
    setCartOpen(true);
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* デスクトップはヘッダーにロゴを常設するため空スペーサー。モバイルはドロワーが前面に出るためロゴを表示 */}
      <Box sx={{ height: { xs: 56, sm: 64 }, px: 2, display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center" }}>
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
              sx={{ width: 32, height: 32, borderRadius: "8px", objectFit: "cover" }}
            />
            <Box sx={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.5px" }}>
              ModParks
            </Box>
          </Link>
        </Box>
      </Box>
      <Divider />

      <SidebarNavList navItems={navItems} onNavigate={handleNavigation}>
        {/* カート（モバイルのみ。デスクトップはヘッダーに常設） */}
        {cartEnabled && (
          <ListItem disablePadding sx={{ mb: 0.5, display: { xs: "block", md: "none" } }}>
            <ListItemButton onClick={handleCartClick} sx={{ borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
                <Badge badgeContent={cartItems.length} color="primary">
                  <ShoppingCartIcon />
                </Badge>
              </ListItemIcon>
              <ListItemText primary={<Typography sx={{ fontWeight: 500 }}>{tCart("title")}</Typography>} />
            </ListItemButton>
          </ListItem>
        )}
      </SidebarNavList>

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
      {!session?.user && <SidebarBottomControls />}
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
