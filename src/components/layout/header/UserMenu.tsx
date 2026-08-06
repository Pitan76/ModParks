"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "next-intl";
import LinkMenuItem from "@/components/ui/LinkMenuItem";
import type { Session } from "next-auth";

export type UserMenuProps = {
  user: NonNullable<Session["user"]>;
};

/** アバターと、そこから開くユーザーメニュー（プロフィール・設定・ログアウト等） */
const UserMenu = ({ user }: UserMenuProps) => {
  const t = useTranslations("Nav");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleAvatarClick = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleSignOut = () => {
    handleMenuClose();
    // next-auth/react はクライアント専用で重いため、押されたときだけ読み込む
    import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/" }));
  };

  return (
    <>
      <Tooltip title={user.displayName ?? user.name ?? ""}>
        <IconButton id="user-avatar-button" onClick={handleAvatarClick} size="small">
          <Avatar
            src={user.avatarUrl ?? user.image ?? undefined}
            alt={user.displayName ?? ""}
            sx={{ width: 32, height: 32 }}
          />
        </IconButton>
      </Tooltip>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <LinkMenuItem href={`/profile/${user.username}`} onClick={handleMenuClose} id="user-menu-profile">
          {t("profile")}
        </LinkMenuItem>
        <LinkMenuItem href="/projects?author=me" onClick={handleMenuClose} id="user-menu-my-projects">
          {t("myProjects")}
        </LinkMenuItem>
        <LinkMenuItem href="/dashboard" onClick={handleMenuClose} id="user-menu-dashboard">
          {t("dashboard")}
        </LinkMenuItem>
        <LinkMenuItem href="/settings" onClick={handleMenuClose} id="user-menu-settings">
          {t("settings")}
        </LinkMenuItem>
        {user.role === "admin" && (
          <LinkMenuItem href="/admin" onClick={handleMenuClose} id="user-menu-admin">
            {t("admin")}
          </LinkMenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleSignOut} id="user-menu-signout">
          {t("logout")}
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;
