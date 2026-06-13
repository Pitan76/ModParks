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
    // Optimistic UI update
    setLiked(!liked);
    setCount((prev) => (liked ? prev - 1 : prev + 1));

    startTransition(async () => {
      const res = await toggleIdeaLike(ideaId);
      if (res && res.error) {
        // Revert on error
        setLiked(liked);
        setCount(count);
        alert(res.error);
      }
    });
  };

  return (
    <Button
      variant={liked ? "contained" : "outlined"}
      color={liked ? "error" : "inherit"}
      startIcon={liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      onClick={handleToggle}
      disabled={!isLoggedIn || isPending}
      sx={{ 
        borderRadius: 8, 
        px: 2,
        textTransform: "none",
        fontWeight: "bold",
      }}
    >
      {tIdea("like", { count })}
    </Button>
  );
}
