"use client";

import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FolderIcon from "@mui/icons-material/Folder";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useTranslations } from "next-intl";
import type { Session } from "next-auth";
import BaseSidebar, { SIDEBAR_WIDTH } from "./BaseSidebar";

export { SIDEBAR_WIDTH };

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  session: Session | null;
}

export default function AppSidebar({ mobileOpen, onMobileClose, session }: AppSidebarProps) {
  const t = useTranslations("Nav");

  const navItems = [
    { id: "home", label: t("home"), path: "/", icon: <HomeIcon /> },
    { id: "projects", label: t("projects"), path: "/projects", icon: <SearchIcon /> },
    { id: "ideas", label: t("ideas"), path: "/ideas", icon: <LightbulbIcon /> },
  ];

  if (session?.user) {
    navItems.push({ id: "dashboard", label: t("dashboard"), path: "/dashboard", icon: <DashboardIcon /> });
    navItems.push({ id: "myProjects", label: t("myProjects"), path: "/projects/manage", icon: <FolderIcon /> });
    navItems.push({ id: "profile", label: t("profile"), path: `/profile/${session.user.username}`, icon: <AccountCircleIcon /> });
  }

  return <BaseSidebar navItems={navItems} mobileOpen={mobileOpen} onMobileClose={onMobileClose} />;
}
