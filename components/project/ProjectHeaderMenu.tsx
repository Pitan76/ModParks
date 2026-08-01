"use client";

import { useState, useTransition } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import XIcon from "@mui/icons-material/X";
import LinkIcon from "@mui/icons-material/Link";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useTranslations } from "next-intl";
import { toggleProjectSubscription } from "@/lib/actions/notification";
import { useCart, useCartEnabled } from "@/components/cart/cartStore";

export type ProjectHeaderMenuProps = {
  project: {
    id: string;
    slug: string;
    title: string;
    iconUrl?: string | null;
    type: string;
  };
  /** 共有に使うプロジェクトページの絶対URL */
  shareUrl: string;
  isLoggedIn: boolean;
  isSubscribed: boolean;
};

/**
 * プロジェクト詳細ヘッダーの三点リーダメニュー。
 * お気に入り・リスト追加以外の操作（共有 / 通知購読 / カート）をまとめる。
 */
export default function ProjectHeaderMenu({ project, shareUrl, isLoggedIn, isSubscribed }: ProjectHeaderMenuProps) {
  const tCommon = useTranslations("Common");
  const tContext = useTranslations("ContextMenu");
  const tNotifications = useTranslations("Notifications");
  const tCart = useTranslations("Cart");

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [isPending, startTransition] = useTransition();

  const cartEnabled = useCartEnabled();
  const { has, add, remove } = useCart();
  const inCart = has(project.id);

  function handleClose() {
    setAnchorEl(null);
  }

  function handleShareX() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(project.title)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener");
    handleClose();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(tContext("copied"));
    } catch {
      // ignore
    }
    handleClose();
  }

  function handleToggleSubscribe() {
    handleClose();
    if (isPending) return;
    setSubscribed((prev) => !prev);
    startTransition(async () => {
      const result = await toggleProjectSubscription(project.id);
      if ("subscribed" in result) setSubscribed(result.subscribed);
    });
  }

  function handleToggleCart() {
    handleClose();
    if (inCart) {
      remove(project.id);
    } else {
      add({
        id: project.id,
        slug: project.slug,
        title: project.title,
        iconUrl: project.iconUrl ?? null,
        type: project.type,
      });
    }
  }

  return (
    <>
      <Tooltip title={tCommon("moreActions")}>
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label={tCommon("moreActions")}>
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {cartEnabled && (
          <MenuItem onClick={handleToggleCart}>
            <ListItemIcon>{inCart ? <ShoppingCartIcon fontSize="small" color="primary" /> : <AddShoppingCartIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{inCart ? tCart("remove") : tCart("add")}</ListItemText>
          </MenuItem>
        )}
        {isLoggedIn && (
          <MenuItem onClick={handleToggleSubscribe} disabled={isPending}>
            <ListItemIcon>{subscribed ? <NotificationsActiveIcon fontSize="small" color="primary" /> : <NotificationsNoneIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{subscribed ? tNotifications("subscribe.subscribed") : tNotifications("subscribe.subscribe")}</ListItemText>
          </MenuItem>
        )}
        {(cartEnabled || isLoggedIn) && <Divider />}
        <MenuItem onClick={handleShareX}>
          <ListItemIcon><XIcon fontSize="small" /></ListItemIcon>
          <ListItemText>X (Twitter)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{tContext("copyLink")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
