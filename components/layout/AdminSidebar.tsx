"use client";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";
import FolderIcon from "@mui/icons-material/Folder";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import BackupIcon from "@mui/icons-material/Backup";
import HistoryIcon from "@mui/icons-material/History";
import GppMaybeIcon from "@mui/icons-material/GppMaybe";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useTranslations } from "next-intl";
import type { Session } from "next-auth";
import BaseSidebar, { SIDEBAR_WIDTH } from "./BaseSidebar";
import type { NavItem } from "./BaseSidebar";

export { SIDEBAR_WIDTH };

export type AdminSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  session: Session | null;
};

/**
 * 管理者ダッシュボード用のサイドバーコンポーネント。
 * 管理者権限（role === "admin"）を持つユーザーに対して、ダッシュボード、ユーザー一覧、プロジェクト一覧、
 * アイデア、通報、構成、バックアップ、監査ログなどの管理用リンクを表示します。
 */
const AdminSidebar = ({ mobileOpen, onMobileClose, session }: AdminSidebarProps) => {
  const tAdmin = useTranslations("Admin");

  let navItems: NavItem[] = [];

  if (session?.user?.role === "admin") {
    navItems = [
      { id: "admin-home", label: tAdmin("sidebar.dashboard"), path: "/admin", icon: <DashboardIcon /> },
      { id: "admin-users", label: tAdmin("sidebar.users"), path: "/admin/users", icon: <PeopleIcon /> },
      { id: "admin-projects", label: tAdmin("sidebar.projects"), path: "/admin/projects", icon: <FolderIcon /> },
      { id: "admin-ideas", label: tAdmin("sidebar.ideas"), path: "/admin/ideas", icon: <LightbulbIcon /> },
      { id: "admin-reports", label: tAdmin("sidebar.reports"), path: "/admin/reports", icon: <ReportIcon /> },
      { id: "admin-appeals", label: tAdmin("sidebar.appeals"), path: "/admin/appeals", icon: <GppMaybeIcon /> },
      { id: "admin-recipe", label: tAdmin("sidebar.recipe"), path: "/admin/recipe", icon: <MenuBookIcon /> },
      { id: "admin-config", label: tAdmin("sidebar.config"), path: "/admin/config", icon: <SettingsIcon /> },
      { id: "admin-backup", label: tAdmin("sidebar.backup"), path: "/admin/backup", icon: <BackupIcon /> },
      { id: "admin-logs", label: tAdmin("sidebar.audit"), path: "/admin/logs", icon: <HistoryIcon /> },
    ];
  }

  return <BaseSidebar navItems={navItems} mobileOpen={mobileOpen} onMobileClose={onMobileClose} />;
};

export default AdminSidebar;
