"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import AppSidebar, { SIDEBAR_WIDTH } from "./AppSidebar";
import AdminSidebar from "./AdminSidebar";
import AppHeader from "./AppHeader";
import OnboardingTour from "./OnboardingTour";
import { ContextMenuProvider } from "@/components/ui/ContextMenu";
import type { Session } from "next-auth";

export type AppLayoutProps = {
  children: ReactNode;
  session: Session | null;
};

/**
 * サイト全体の基本レイアウトを提供するコンポーネント。
 * サイドバー（管理用/通常用）、ヘッダー、メインコンテンツ、コンテキストメニュー、
 * およびオンボーディングツアーの連携を行います。
 */
const COLLAPSE_STORAGE_KEY = "sidebarCollapsed";

const AppLayout = ({ children, session }: AppLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() || "";
  const isAdminPage = pathname.includes("/admin");
  const tNav = useTranslations("Nav");

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const SidebarComponent = isAdminPage ? AdminSidebar : AppSidebar;

  return (
    <ContextMenuProvider>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <SidebarComponent
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          session={session}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        {collapsed && (
          <IconButton
            onClick={handleToggleCollapse}
            aria-label={tNav("expandSidebar")}
            size="small"
            sx={{
              display: { xs: "none", md: "flex" },
              position: "fixed",
              bottom: 12,
              left: 12,
              zIndex: (theme) => theme.zIndex.drawer + 1,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        )}
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            width: { md: collapsed ? "100%" : `calc(100% - ${SIDEBAR_WIDTH}px)` },
            transition: (theme) =>
              theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          }}
        >
          <AppHeader session={session} onMenuClick={handleDrawerToggle} />
          <Box component="main" sx={{ flexGrow: 1 }}>
            {children}
          </Box>
        </Box>
        <OnboardingTour />
      </Box>
    </ContextMenuProvider>
  );
};

export default AppLayout;
