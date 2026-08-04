"use client";

import PersonIcon from "@mui/icons-material/Person";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PaletteIcon from "@mui/icons-material/Palette";
import SecurityIcon from "@mui/icons-material/Security";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PostAddIcon from "@mui/icons-material/PostAdd";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HubIcon from "@mui/icons-material/Hub";
import RedeemIcon from "@mui/icons-material/Redeem";
import AppsIcon from "@mui/icons-material/Apps";
import { useTranslations } from "next-intl";
import type { Session } from "next-auth";
import BaseSidebar, { SIDEBAR_WIDTH } from "./BaseSidebar";
import type { NavItem } from "./BaseSidebar";

export { SIDEBAR_WIDTH };

export type SettingsSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  session: Session | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

/**
 * 設定画面用のサイドバー。
 * 管理画面と同じく、各セクションを独立したルートとして左から選ばせる。
 */
const SettingsSidebar = ({ mobileOpen, onMobileClose, session, collapsed, onToggleCollapse }: SettingsSidebarProps) => {
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
        { id: "settings-api-keys", label: t("apiKeys.title"), path: "/settings/api-keys", icon: <VpnKeyIcon /> },
        { id: "settings-oauth-apps", label: t("oauthApps.title"), path: "/settings/oauth-apps", icon: <AppsIcon /> },
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
    />
  );
};

export default SettingsSidebar;
