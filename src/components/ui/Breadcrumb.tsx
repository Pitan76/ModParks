import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/Home";
import LinkButton from "@/components/ui/LinkButton";
import type { ReactNode } from "react";

/**
 * パンくずの 1 項目。
 * href を持つものはリンク、持たないものは現在地として表示される。
 */
export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

export type BreadcrumbProps = {
  /** ホーム(/)の後ろに並べる項目。末尾は現在地として href なしにする */
  items: BreadcrumbItem[];
  /** ホームリンクを先頭に表示するか */
  showHome?: boolean;
};

const linkSx = {
  p: 0,
  minWidth: "auto",
  color: "text.secondary",
  "&:hover": { bgcolor: "transparent", color: "primary.main" },
} as const;

const Separator = () => <span>/</span>;

/**
 * サイト共通のパンくずリスト。プロジェクト詳細ページの表示を基準とする。
 */
const Breadcrumb = ({ items, showHome = true }: BreadcrumbProps) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, typography: "body2", color: "text.secondary", flexWrap: "wrap", minWidth: 0 }}>
        {showHome && (
          <>
            <LinkButton href="/" variant="text" sx={linkSx}>
              <HomeIcon fontSize="small" />
            </LinkButton>
            <Separator />
          </>
        )}
        {items.map((item, index) => (
          <Box key={index} component="span" sx={{ display: "contents" }}>
            {index > 0 && <Separator />}
            {item.href ? (
              <LinkButton href={item.href} variant="text" sx={linkSx}>
                {item.label}
              </LinkButton>
            ) : (
              <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60vw" }}>
                {item.label}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Breadcrumb;
