"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import BlockIcon from "@mui/icons-material/Block";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTranslations } from "next-intl";
import { useCart, cartEnabledStore } from "@/components/cart/cartStore";
import { useContextMenu } from "@/components/ui/ContextMenu";
import CartDrawer from "@/components/cart/CartDrawer";

export type HeaderCartButtonProps = {
  userId: string | null;
};

/**
 * カートを開くボタンとドロワー本体。
 * モバイルではサイドバー側に導線を置くため、ボタンは md 以上でのみ表示する。
 */
const HeaderCartButton = ({ userId }: HeaderCartButtonProps) => {
  const t = useTranslations("Cart");
  const tMenu = useTranslations("ContextMenu");
  const [open, setOpen] = useState(false);
  const { items, clear } = useCart();

  const onContextMenu = useContextMenu([
    {
      id: "cm-cart-open",
      label: tMenu("open"),
      icon: <OpenInNewIcon fontSize="small" />,
      onClick: () => setOpen(true),
    },
    {
      id: "cm-cart-clear",
      label: t("clear"),
      icon: <DeleteSweepIcon fontSize="small" />,
      disabled: items.length === 0,
      danger: true,
      onClick: () => clear(),
    },
    { type: "divider" },
    {
      id: "cm-cart-disable",
      label: t("disableFeature"),
      icon: <BlockIcon fontSize="small" />,
      onClick: () => cartEnabledStore.set(false),
    },
  ]);

  return (
    <>
      <Tooltip title={t("title")}>
        <IconButton
          id="nav-cart-button"
          color="inherit"
          size="small"
          onClick={() => setOpen(true)}
          onContextMenu={onContextMenu}
          sx={{ mr: 0.5, display: { xs: "none", md: "inline-flex" } }}
        >
          <Badge badgeContent={items.length} color="primary">
            <ShoppingCartIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <CartDrawer open={open} onClose={() => setOpen(false)} userId={userId} />
    </>
  );
};

export default HeaderCartButton;
