"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { usePathname } from "next/navigation";
import AppSidebar, { SIDEBAR_WIDTH } from "./AppSidebar";
import AdminSidebar from "./AdminSidebar";
import AppHeader from "./AppHeader";
import OnboardingTour from "./OnboardingTour";
import { ContextMenuProvider } from "@/components/ui/ContextMenu";

import type { Session } from "next-auth";

export default function AppLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname() || "";
  const isAdminPage = pathname.includes("/admin");

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const SidebarComponent = isAdminPage ? AdminSidebar : AppSidebar;

  return (
    <ContextMenuProvider>
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SidebarComponent
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        session={session}
      />
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
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
}
