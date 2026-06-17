"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import Typography from "@mui/material/Typography";
import { toggleProjectFavorite, toggleCookieFavorite } from "@/lib/actions/favorite";
import { useTranslations } from "next-intl";

interface ProjectFavoriteButtonProps {
  projectId: string;
  initialCount: number;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  variant?: "icon" | "button";
}

export default function ProjectFavoriteButton({
  projectId,
  initialCount,
  initialFavorited,
  isLoggedIn,
  variant = "button"
}: ProjectFavoriteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const t = useTranslations("Project");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPending || isMutating) return;

    setIsMutating(true);

    // 楽観的UI更新
    setFavorited((prev) => !prev);
    setCount((prev) => (favorited ? prev - 1 : prev + 1));

    startTransition(async () => {
      try {
        const result = isLoggedIn ? await toggleProjectFavorite(projectId) : await toggleCookieFavorite(projectId);
        if (result.error) {
          // 失敗したら元に戻す
          setFavorited(initialFavorited);
          setCount(initialCount);
          alert(t("favorite.error"));
        } else {
          // 成功した場合、DB側の最新状態と同期する
          if (result.favorited !== undefined) {
              setFavorited(result.favorited);
          }
        }
      } finally {
        setIsMutating(false);
      }
    });
  };

  if (variant === "icon") {
    return (
      <IconButton 
        onClick={handleClick} 
        disabled={isPending || isMutating}
        color={favorited ? "primary" : "default"}
        sx={{ 
          transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          transform: favorited ? "scale(1.1)" : "scale(1)",
        }}
      >
        {favorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        {count > 0 && (
          <Typography variant="caption" sx={{ ml: 0.5, fontWeight: "bold" }}>
            {count}
          </Typography>
        )}
      </IconButton>
    );
  }

  return (
    <Button
      variant={favorited ? "contained" : "outlined"}
      color="primary"
      startIcon={favorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
      onClick={handleClick}
      disabled={isPending || isMutating}
      fullWidth
      sx={{
        transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: favorited ? "scale(1.02)" : "scale(1)",
        borderRadius: 2,
        height: "40px",
      }}
    >
      {favorited ? t("favorite.favorited") : t("favorite.favorite")}
      {count > 0 && ` (${count})`}
    </Button>
  );
}
