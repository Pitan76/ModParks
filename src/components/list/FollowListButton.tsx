"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkRemoveIcon from "@mui/icons-material/BookmarkRemove";
import { useRouter } from "next/navigation";

interface Props {
  collectionId: string;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  isLoggedIn: boolean;
}

export default function FollowListButton({ collectionId, initialIsFollowing, initialFollowersCount, isLoggedIn }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleFollow = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/v1/collections/${collectionId}/follow`, { method });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        setFollowersCount(c => isFollowing ? c - 1 : c + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{followersCount}</Box> Followers
      </Typography>
      <Button 
        variant={isFollowing ? "outlined" : "contained"} 
        color={isFollowing ? "inherit" : "primary"}
        startIcon={isFollowing ? <BookmarkRemoveIcon /> : <BookmarkAddIcon />}
        onClick={handleToggleFollow}
        disabled={loading}
        size="small"
      >
        {isFollowing ? "Unfollow" : "Follow"}
      </Button>
    </Box>
  );
}
