"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import AppSidebar, { SIDEBAR_WIDTH } from "./AppSidebar";
import AppHeader from "./AppHeader";

interface Session {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    role?: string;
  };
}

export default function AppLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppSidebar
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
    </Box>
  );
}
