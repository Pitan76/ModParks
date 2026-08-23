"use client";

import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import RemoveShoppingCartIcon from "@mui/icons-material/RemoveShoppingCart";
import BlockIcon from "@mui/icons-material/Block";
import { useTranslations } from "next-intl";
import { useCart, useCartEnabled, cartEnabledStore, type CartItem } from "@/components/cart/cartStore";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";

/**
 * 右クリックメニューのカート関連項目を組み立てる。
 *
 * カート機能を切っている場合は項目自体を出さない（設定 > テーマから戻せる）。
 * @returns 区切り線を含む項目列。カート無効時は空配列
 */
export function useCartMenuItems(item: CartItem | null): ContextMenuItem[] {
  const t = useTranslations("Cart");
  const enabled = useCartEnabled();
  const { has, add, remove } = useCart();

  if (!enabled || !item) return [];

  const inCart = has(item.id);

  return [
    { type: "divider" },
    {
      id: "cm-cart-toggle",
      label: inCart ? t("remove") : t("add"),
      icon: inCart ? <RemoveShoppingCartIcon fontSize="small" /> : <AddShoppingCartIcon fontSize="small" />,
      onClick: () => (inCart ? remove(item.id) : add(item)),
    },
    {
      id: "cm-cart-disable",
      label: t("disableFeature"),
      icon: <BlockIcon fontSize="small" />,
      onClick: () => cartEnabledStore.set(false),
    },
  ];
}
