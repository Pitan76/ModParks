"use client";

import SettingsIcon from "@mui/icons-material/Settings";
import type { ButtonProps } from "@mui/material/Button";
import LinkButton from "@/components/ui/LinkButton";

/**
 * 設定ページへの導線コンポーネントのProps型
 */
type SettingsLinkProps = Pick<ButtonProps, "size" | "variant" | "color" | "sx"> & {
  href: string;
  label: string;
};

/**
 * 各画面から関連する設定ページへ誘導するリンク。
 * 導線の見た目を統一するため、歯車アイコン付きのボタンに固定する。
 */
const SettingsLink = ({ href, label, size = "small", variant = "text", ...rest }: SettingsLinkProps) => {
  return (
    <LinkButton href={href} size={size} variant={variant} startIcon={<SettingsIcon />} {...rest}>
      {label}
    </LinkButton>
  );
};

export default SettingsLink;
