"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { useRouter } from "next/navigation";

interface Props {
  targetUsername: string;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  isLoggedIn: boolean;
}

export default function FollowUserButton({ targetUsername, initialIsFollowing, initialFollowersCount, initialFollowingCount, isLoggedIn }: Props) {
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
      const res = await fetch(`/api/v1/users/${targetUsername}/follow`, { method });
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 3 }}>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{followersCount}</Box> Followers
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{initialFollowingCount}</Box> Following
        </Typography>
      </Box>
      <Button 
        variant={isFollowing ? "outlined" : "contained"} 
        color={isFollowing ? "inherit" : "primary"}
        startIcon={isFollowing ? <PersonRemoveIcon /> : <PersonAddIcon />}
        onClick={handleToggleFollow}
        disabled={loading}
        size="small"
        sx={{ width: "fit-content", mt: 1 }}
      >
        {isFollowing ? "Unfollow" : "Follow"}
      </Button>
    </Box>
  );
}
