"use client";

import { useSession } from "next-auth/react";

import PersonIcon from "@mui/icons-material/Person";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PaletteIcon from "@mui/icons-material/Palette";
import SecurityIcon from "@mui/icons-material/Security";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PostAddIcon from "@mui/icons-material/PostAdd";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HubIcon from "@mui/icons-material/Hub";
import RedeemIcon from "@mui/icons-material/Redeem";
import { useTranslations } from "next-intl";
import BaseSidebar, { SIDEBAR_WIDTH } from "./BaseSidebar";
import type { NavItem, SidebarProps } from "./BaseSidebar";

export { SIDEBAR_WIDTH };

export type SettingsSidebarProps = SidebarProps;

/**
 * 設定画面用のサイドバー。
 * 管理画面と同じく、各セクションを独立したルートとして左から選ばせる。
 */
const SettingsSidebar = ({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SettingsSidebarProps) => {
  // HTML をセッション非依存に保つため、ログイン状態はクライアントで解決する
  const { data: session } = useSession();
  const t = useTranslations("Settings");

  const navItems: NavItem[] = session?.user
    ? [
        { id: "settings-profile", label: t("profile.title"), path: "/settings/profile", icon: <PersonIcon /> },
        { id: "settings-account", label: t("account.title"), path: "/settings/account", icon: <ManageAccountsIcon /> },
        { id: "settings-security", label: t("security.title"), path: "/settings/security", icon: <SecurityIcon /> },
        { id: "settings-theme", label: t("theme.title"), path: "/settings/theme", icon: <PaletteIcon /> },
        { id: "settings-posting", label: t("posting.title"), path: "/settings/posting", icon: <PostAddIcon /> },
        { id: "settings-notifications", label: t("notifications.title"), path: "/settings/notifications", icon: <NotificationsIcon /> },
        { id: "settings-integration", label: t("integration.title"), path: "/settings/integration", icon: <HubIcon /> },
        { id: "settings-developer", label: t("developer.title"), path: "/settings/developer", icon: <VpnKeyIcon /> },
        { id: "settings-rewards", label: t("rewards.title"), path: "/settings/rewards", icon: <RedeemIcon /> },
      ]
    : [];

  return (
    <BaseSidebar
      navItems={navItems}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      hideCart={true}
    />
  );
};

export default SettingsSidebar;
