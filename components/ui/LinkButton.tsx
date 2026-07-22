"use client";

import Button from "@mui/material/Button";
import type { ButtonProps } from "@mui/material/Button";
import { Link } from "@/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクボタンコンポーネントのProps型
 */
type LinkButtonProps = ButtonProps & ComponentProps<typeof Link>;

/**
 * MUI の Button コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkButton = ({ prefetch = false, ...props }: LinkButtonProps) => {
  return <Button component={Link} prefetch={prefetch} {...props} />;
};

export default LinkButton;
