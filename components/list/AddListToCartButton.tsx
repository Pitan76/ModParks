"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import { useTranslations } from "next-intl";
import { useCart, type CartItem } from "@/components/cart/cartStore";

interface AddListToCartButtonProps {
  /** リストに含まれるプロジェクト */
  items: CartItem[];
}

/**
 * リスト内のプロジェクトをまとめてカートに追加するボタン。
 * 追加済みのものは自動的に除外される。
 */
export default function AddListToCartButton({ items }: AddListToCartButtonProps) {
  const tCart = useTranslations("Cart");
  const { addMany, items: cartItems } = useCart();
  const [message, setMessage] = useState<string | null>(null);

  if (items.length === 0) return null;

  const remaining = items.filter((i) => !cartItems.some((c) => c.id === i.id)).length;

  function handleClick() {
    const added = addMany(items);
    setMessage(added > 0 ? tCart("addedItems", { count: added }) : tCart("allInCart"));
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddShoppingCartIcon />}
        onClick={handleClick}
        disabled={remaining === 0}
      >
        {tCart("addList")}
      </Button>
      <Snackbar
        open={message !== null}
        autoHideDuration={3000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setMessage(null)} sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
