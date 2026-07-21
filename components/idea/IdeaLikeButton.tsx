"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { toggleIdeaLike } from "@/lib/actions/idea";
import { useTranslations } from "next-intl";

export interface IdeaLikeButtonProps {
  ideaId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export default function IdeaLikeButton({ ideaId, initialLiked, initialCount, isLoggedIn }: IdeaLikeButtonProps) {
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
      const res = await toggleIdeaLike(ideaId);
      if (res && res.error) {
        // エラー時は元に戻す
        setLiked(initialLiked);
        setCount(initialCount);
        alert(res.error);
      }
    });
  };

  return (
    <Button
      variant={liked ? "contained" : "outlined"}
      color="primary"
      startIcon={liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
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
