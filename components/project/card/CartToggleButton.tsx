"use client";

import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useTranslations } from "next-intl";
import { useCart, type CartItem } from "@/components/cart/cartStore";

export type CartToggleButtonProps = {
  item: CartItem;
};

/**
 * カートへの追加／削除を切り替えるボタン。
 * カード全体がリンクになっている場所で使うため、クリックは伝播させない。
 */
const CartToggleButton = ({ item }: CartToggleButtonProps) => {
  const t = useTranslations("Cart");
  const { has, add, remove } = useCart();
  const inCart = has(item.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) return remove(item.id);
    add(item);
  };

  return (
    <Tooltip title={inCart ? t("remove") : t("add")} arrow>
      <IconButton
        size="small"
        onClick={handleClick}
        color={inCart ? "primary" : "default"}
        sx={{
          p: 0.5,
          flexShrink: 0,
          border: "1px solid",
          borderColor: inCart ? "primary.main" : "divider",
          borderRadius: 1.5,
          bgcolor: inCart ? "action.selected" : "background.paper",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {inCart ? <ShoppingCartIcon fontSize="small" /> : <AddShoppingCartIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

export default CartToggleButton;
