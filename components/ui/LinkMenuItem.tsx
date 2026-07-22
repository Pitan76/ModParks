"use client";

import MenuItem from "@mui/material/MenuItem";
import type { MenuItemProps } from "@mui/material/MenuItem";
import { Link } from "@/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクメニューアイテムコンポーネントのProps型
 */
type LinkMenuItemProps = MenuItemProps & ComponentProps<typeof Link>;

/**
 * MUI の MenuItem コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkMenuItem = (props: LinkMenuItemProps) => {
  // eslint-disable-next-line no-restricted-syntax
  return <MenuItem component={Link} {...props} />;
};

export default LinkMenuItem;
