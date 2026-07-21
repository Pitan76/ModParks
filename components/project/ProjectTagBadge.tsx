import BaseBadge from "@/components/ui/BaseBadge";
import { useTranslations } from "next-intl";

export interface ProjectTagBadgeProps {
  tag: string;
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  clickable?: boolean;
}

export default function ProjectTagBadge({ tag, size = "small", variant = "filled", onClick, clickable }: ProjectTagBadgeProps) {
  const tTags = useTranslations("Tags");

  const getTagLabel = (tagStr: string) => {
    const key = tagStr.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return tTags.has(key as any) ? tTags(key as any) : tagStr;
  };

  return (
    <BaseBadge
      label={getTagLabel(tag)}
      size={size}
      variant={variant}
      clickable={clickable}
      onClick={onClick}
      sx={{ 
        height: size === "small" ? 18 : undefined, 
        fontSize: size === "small" ? "0.6rem" : undefined 
      }}
    />
  );
}
