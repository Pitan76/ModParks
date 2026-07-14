"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import Tooltip from "@mui/material/Tooltip";
import { toggleDeveloperSubscription } from "@/lib/actions/notification";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import { Link as RoutingLink } from "@/i18n/routing";
import { getFollowList } from "@/lib/actions/profile";

interface Props {
  targetUsername: string;
  targetUserId: string;
  initialIsFollowing: boolean;
  initialSubscribed: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  isLoggedIn: boolean;
  isOwner?: boolean;
  children?: React.ReactNode;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export default function FollowUserButton({ targetUsername, targetUserId, initialIsFollowing, initialSubscribed, initialFollowersCount, initialFollowingCount, isLoggedIn, isOwner = false, children }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [subLoading, setSubLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("Common");
  const tn = useTranslations("Notifications");

  const [dialogOpen, setDialogOpen] = useState<"followers" | "following" | null>(null);
  const [dialogUsers, setDialogUsers] = useState<UserSummary[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);

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

  const handleToggleSubscribe = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setSubLoading(true);
    setSubscribed((v) => !v);
    try {
      const result = await toggleDeveloperSubscription(targetUserId);
      if ("subscribed" in result) setSubscribed(result.subscribed);
    } finally {
      setSubLoading(false);
    }
  };

  const openDialog = async (type: "followers" | "following") => {
    setDialogOpen(type);
    setDialogLoading(true);
    try {
      const users = await getFollowList(targetUsername, type);
      setDialogUsers(users as any);
    } catch (e) {
      console.error(e);
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: { xs: "center", sm: "flex-start" } }}>
        <Box sx={{ display: "flex", gap: { xs: 2, sm: 3 }, flexWrap: "wrap", alignItems: "center", justifyContent: { xs: "center", sm: "flex-start" } }}>
          {children}
          <Typography 
            variant="body2" 
            color="text.secondary" 
            onClick={() => openDialog("followers")}
            sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
          >
            <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{followersCount}</Box> {t("followers")}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            onClick={() => openDialog("following")}
            sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
          >
            <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{initialFollowingCount}</Box> {t("following")}
          </Typography>
        </Box>
        {!isOwner && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Button
              variant={isFollowing ? "outlined" : "contained"}
              color={isFollowing ? "inherit" : "primary"}
              startIcon={isFollowing ? <PersonRemoveIcon /> : <PersonAddIcon />}
              onClick={handleToggleFollow}
              disabled={loading}
              size="small"
              sx={{ width: "fit-content" }}
            >
              {isFollowing ? t("unfollow") : t("follow")}
            </Button>
            <Tooltip title={subscribed ? tn("subscribe.developerActive") : tn("subscribe.developer")}>
              <IconButton
                onClick={handleToggleSubscribe}
                disabled={subLoading}
                size="small"
                color={subscribed ? "primary" : "default"}
                aria-label="notification bell"
              >
                {subscribed ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Dialog open={!!dialogOpen} onClose={() => setDialogOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2 }}>
          {dialogOpen === "followers" ? t("followers") : t("following")}
          <IconButton
            onClick={() => setDialogOpen(null)}
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {dialogLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : dialogUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
              No users found.
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {dialogUsers.map((u) => (
                <ListItem 
                  key={u.id} 
                  component={RoutingLink as any} 
                  href={`/profile/${u.username}`} 
                  onClick={() => setDialogOpen(null)}
                  sx={{ color: "inherit", textDecoration: "none", "&:hover": { bgcolor: "action.hover" } }}
                >
                  <ListItemAvatar>
                    <Avatar src={u.avatarUrl || ""} />
                  </ListItemAvatar>
                  <ListItemText 
                    primary={<Typography sx={{ fontWeight: 600 }}>{u.displayName || u.username}</Typography>}
                    secondary={`@${u.username}`} 
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
