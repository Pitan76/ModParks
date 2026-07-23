"use client";

import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import { useTranslations } from "next-intl";
import LinkCardActionArea from "@/components/ui/LinkCardActionArea";
import { useContextMenu, useCommonItems, useContextMenuContext } from "@/components/ui/ContextMenu";
import { formatDate } from "@/lib/utils/format";
import { toPlainDescription } from "@/lib/utils/plainText";
import { useColorMode } from "@/components/ThemeRegistry";

export interface IdeaCardData {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: Date | number;
  likesCount: number;
  commentsCount: number;
  authorName: string | null;
}

/**
 * アイデア一覧の各カード（クライアント）。
 * 右クリックで独自コンテキストメニューを表示する。
 */
export default function IdeaCard({ idea }: { idea: IdeaCardData }) {
  const tIdea = useTranslations("Idea");
  const tMenu = useTranslations("ContextMenu");
  const { isNewTheme } = useColorMode();
  const { isDisabled } = useContextMenuContext();

  const c = useCommonItems();
  const href = `/ideas/${idea.id}`;
  const onContextMenu = useContextMenu(
    [
      c.open(href),
      c.openNewTab(href),
      { type: "divider" },
      c.copyLink(href),
      c.share(href, idea.title),
      c.copyText(idea.title, tMenu("copyText")),
    ],
    { passthrough: { links: false } },
  );

  const statusLabel =
    idea.status === "open"
      ? tIdea("status.open")
      : idea.status === "in_progress"
        ? tIdea("status.in_progress")
        : tIdea("status.resolved");

  return (
    <Card
      variant="outlined"
      onContextMenu={onContextMenu}
      sx={{ 
        WebkitTouchCallout: isDisabled ? "default" : "none",
        boxShadow: "none",
        transition: "0.2s", 
        ...(isNewTheme ? {
          border: "none",
          borderRadius: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: "transparent",
          "&:hover": {
            backgroundColor: "action.hover",
          }
        } : {
          "&:hover": { borderColor: "primary.main" }
        })
      }}
    >
      <LinkCardActionArea href={href} sx={{ p: isNewTheme ? 2 : 3 }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {idea.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {toPlainDescription(idea.content)}
            </Typography>
            
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, mb: 2, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                by {idea.authorName || "Unknown"}
              </Typography>
              <Typography variant="caption" color="text.disabled">•</Typography>
              <Typography variant="caption" color="text.disabled">
                {formatDate(idea.createdAt)}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 3 }, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <FavoriteIcon fontSize="small" />
                <Typography variant="body2">{idea.likesCount}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <CommentIcon fontSize="small" />
                <Typography variant="body2">{idea.commentsCount}</Typography>
              </Box>
              <Chip
                label={statusLabel}
                size="small"
                color={idea.status === "open" ? "primary" : idea.status === "in_progress" ? "warning" : "success"}
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>
      </LinkCardActionArea>
    </Card>
  );
}
