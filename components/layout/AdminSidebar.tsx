"use client";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";
import FolderIcon from "@mui/icons-material/Folder";
import { useTranslations } from "next-intl";
import type { Session } from "next-auth";
import BaseSidebar, { SIDEBAR_WIDTH } from "./BaseSidebar";

export { SIDEBAR_WIDTH };

interface AdminSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  session: Session | null;
}

export default function AdminSidebar({ mobileOpen, onMobileClose, session }: AdminSidebarProps) {
  const tAdmin = useTranslations("Admin");

  let navItems: any[] = [];

  if (session?.user?.role === "admin") {
    navItems = [
      { id: "admin-home", label: tAdmin("sidebar.dashboard"), path: "/admin", icon: <DashboardIcon /> },
      { id: "admin-users", label: tAdmin("sidebar.users"), path: "/admin/users", icon: <PeopleIcon /> },
      { id: "admin-projects", label: tAdmin("sidebar.projects"), path: "/admin/projects", icon: <FolderIcon /> },
      { id: "admin-reports", label: tAdmin("sidebar.reports"), path: "/admin/reports", icon: <ReportIcon /> },
      { id: "admin-config", label: tAdmin("sidebar.config"), path: "/admin/config", icon: <SettingsIcon /> },
    ];
  }

  return <BaseSidebar navItems={navItems} mobileOpen={mobileOpen} onMobileClose={onMobileClose} />;
}
