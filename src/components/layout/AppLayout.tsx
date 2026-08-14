"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { usePathname } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import AppSidebar, { SIDEBAR_WIDTH } from "./AppSidebar";
import AppHeader from "./AppHeader";

const AdminSidebar = dynamic(() => import("./AdminSidebar"), { ssr: false });
const SettingsSidebar = dynamic(() => import("./SettingsSidebar"), { ssr: false });
const OnboardingTour = dynamic(() => import("./OnboardingTour"), { ssr: false });
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
  const isSettingsPage = pathname.includes("/settings");
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

  let SidebarComponent: React.ComponentType<any> = AppSidebar;
  if (isAdminPage) SidebarComponent = AdminSidebar;
  else if (isSettingsPage) SidebarComponent = SettingsSidebar;

  return (
    <ContextMenuProvider>
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AppHeader session={session} onMenuClick={handleDrawerToggle} collapsed={collapsed} />
        <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
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
            component="main"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              width: { md: collapsed ? "100%" : `calc(100% - ${SIDEBAR_WIDTH}px)` },
              transition: (theme) =>
                theme.transitions.create("width", {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
            }}
          >
            {children}
          </Box>
        </Box>
        <OnboardingTour />
      </Box>
    </ContextMenuProvider>
  );
};

export default AppLayout;
