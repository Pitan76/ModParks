"use client";

import ListItem from "@mui/material/ListItem";
import type { ListItemProps } from "@mui/material/ListItem";
import { Link } from "@/lib/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクリストアイテムコンポーネントのProps型
 */
type LinkListItemProps = ListItemProps & ComponentProps<typeof Link>;

/**
 * MUI の ListItem コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkListItem = ({ prefetch = false, ...props }: LinkListItemProps) => {
  // eslint-disable-next-line no-restricted-syntax
  return <ListItem component={Link} {...props} prefetch={prefetch} />;
};

export default LinkListItem;
