"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { toggleIdeaFavorite } from "@/lib/actions/idea";
import { useTranslations } from "next-intl";

export interface IdeaLikeButtonProps {
  ideaId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  variant?: "icon" | "button";
}

export default function IdeaLikeButton({
  ideaId,
  initialLiked,
  initialCount,
  isLoggedIn,
  variant = "button"
}: IdeaLikeButtonProps) {
  const tIdea = useTranslations("Idea");
  const [isPending, startTransition] = useTransition();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  const handleToggle = () => {
    if (isPending) return;

    // 楽観的UI更新
    setLiked(!liked);
    setCount((prev) => (liked ? prev - 1 : prev + 1));

    startTransition(async () => {
      const res = await toggleIdeaFavorite(ideaId);
      if (res && res.error) {
        // エラー時は元に戻す
        setLiked(initialLiked);
        setCount(initialCount);
        alert(res.error);
      }
    });
  };

  const tooltipTitle = liked ? tIdea("liked") : tIdea("like");

  if (variant === "icon") {
    return (
      <Tooltip title={tooltipTitle} placement="top" arrow>
        <span style={{ display: "inline-flex", alignSelf: "flex-start" }}>
          <IconButton
            onClick={handleToggle}
            disabled={!isLoggedIn || isPending}
            color={liked ? "error" : "default"}
            sx={{ 
              transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              transform: liked ? "scale(1.1)" : "scale(1)",
            }}
          >
            {liked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            {count > 0 && (
              <Typography variant="caption" sx={{ ml: 0.5, fontWeight: "bold" }}>
                {count}
              </Typography>
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={liked ? "contained" : "outlined"}
      color="primary"
      startIcon={liked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
      onClick={handleToggle}
      disabled={!isLoggedIn || isPending}
      fullWidth
      sx={{ 
        transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: liked ? "scale(1.02)" : "scale(1)",
        borderRadius: 2, 
        height: "40px",
        fontWeight: "bold",
        whiteSpace: "nowrap",
      }}
    >
      {liked ? tIdea("liked") : tIdea("like")}
      {count > 0 && ` (${count})`}
    </Button>
  );
}
