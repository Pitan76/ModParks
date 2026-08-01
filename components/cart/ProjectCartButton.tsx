"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useTranslations } from "next-intl";
import { useCart, useCartEnabled } from "./cartStore";

export type ProjectCartButtonProps = {
  project: {
    id: string;
    slug: string;
    title: string;
    iconUrl?: string | null;
    type: string;
  };
};

/**
 * プロジェクト詳細ページ用のカート追加/削除アイコンボタン。
 * 設定でカート機能をオフにしている場合は何も表示しない。
 */
const ProjectCartButton = ({ project }: ProjectCartButtonProps) => {
  const tCart = useTranslations("Cart");
  const cartEnabled = useCartEnabled();
  const { has, add, remove } = useCart();
  const inCart = has(project.id);

  if (!cartEnabled) return null;

  const handleClick = () => {
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
  };

  return (
    <Tooltip title={inCart ? tCart("remove") : tCart("add")}>
      <IconButton onClick={handleClick} color={inCart ? "primary" : "default"}>
        {inCart ? <ShoppingCartIcon /> : <AddShoppingCartIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ProjectCartButton;
