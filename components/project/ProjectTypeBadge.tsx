import BaseBadge from "@/components/ui/BaseBadge";
import { useTranslations } from "next-intl";

export interface ProjectTypeBadgeProps {
  type: string;
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
}

const TYPE_COLOR: Record<string, "primary" | "secondary" | "success" | "warning" | "info" | "error" | "default"> = {
  mod:          "primary",
  plugin:       "success",
  resourcepack: "secondary",
  datapack:     "warning",
  shader:       "info",
  modpack:      "error",
};

export default function ProjectTypeBadge({ type, size = "small", variant = "filled" }: ProjectTypeBadgeProps) {
  const tProject = useTranslations("Project");
  const color = TYPE_COLOR[type] || "default";

  return (
    <BaseBadge
      label={tProject.has(`type.${type}`) ? tProject(`type.${type}`) : type}
      color={color}
      variant={variant}
      size={size}
      sx={{ 
        height: size === "small" ? 20 : undefined, 
        fontSize: size === "small" ? "0.65rem" : undefined, 
        flexShrink: 0,
      }}
    />
  );
}
