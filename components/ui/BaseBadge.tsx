import Chip from "@mui/material/Chip";
import { SxProps, Theme } from "@mui/material/styles";

export interface BaseBadgeProps {
  label: string;
  variant?: "filled" | "outlined";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "info" | "error";
  size?: "small" | "medium";
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  clickable?: boolean;
  sx?: SxProps<Theme>;
}

export default function BaseBadge({
  label,
  variant = "filled",
  color = "default",
  size = "small",
  onClick,
  clickable,
  sx,
}: BaseBadgeProps) {
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
}
