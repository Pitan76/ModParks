"use client";

import IconButton from "@mui/material/IconButton";
import type { IconButtonProps } from "@mui/material/IconButton";
import { Link } from "@/lib/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクアイコンボタンコンポーネントのProps型
 */
type LinkIconButtonProps = IconButtonProps & ComponentProps<typeof Link>;

/**
 * MUI の IconButton コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkIconButton = ({ prefetch = false, ...props }: LinkIconButtonProps) => {
  // eslint-disable-next-line no-restricted-syntax
  return <IconButton component={Link} prefetch={prefetch} {...props} />;
};

export default LinkIconButton;
