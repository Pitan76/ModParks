"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useTranslations } from "next-intl";
import { useCart } from "@/components/cart/cartStore";
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
  const [open, setOpen] = useState(false);
  const { items } = useCart();

  return (
    <>
      <Tooltip title={t("title")}>
        <IconButton
          id="nav-cart-button"
          color="inherit"
          size="small"
          onClick={() => setOpen(true)}
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
