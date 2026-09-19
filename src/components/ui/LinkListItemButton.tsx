"use client";

import ListItemButton from "@mui/material/ListItemButton";
import type { ListItemButtonProps } from "@mui/material/ListItemButton";
import { Link } from "@/lib/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクリストアイテムボタンコンポーネントのProps型
 */
type LinkListItemButtonProps = ListItemButtonProps & ComponentProps<typeof Link>;

/**
 * MUI の ListItemButton コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkListItemButton = ({ prefetch = false, ...props }: LinkListItemButtonProps) => {
  // eslint-disable-next-line no-restricted-syntax
  return <ListItemButton component={Link} {...props} prefetch={prefetch} />;
};

export default LinkListItemButton;
