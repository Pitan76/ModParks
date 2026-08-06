import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";
import type { MouseEvent } from "react";

export type BaseBadgeProps = {
  label: string;
  variant?: "filled" | "outlined";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "info" | "error";
  size?: "small" | "medium";
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  clickable?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * プロジェクト共通で使用されるバッジ（Chip）コンポーネント。
 * タグや状態の表示などに使用します。
 */
const BaseBadge = ({
  label,
  variant = "filled",
  color = "default",
  size = "small",
  onClick,
  clickable,
  sx,
}: BaseBadgeProps) => {
  return (
    <Chip
      label={label}
      variant={variant}
      color={color}
      size={size}
      onClick={onClick}
      clickable={clickable}
      sx={{
        fontWeight: size === "small" ? 500 : 600,
        textTransform: "none",
        ...sx,
      }}
    />
  );
};

export default BaseBadge;
