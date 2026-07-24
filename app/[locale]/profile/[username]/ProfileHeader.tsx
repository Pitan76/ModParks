import { getTranslations } from "next-intl/server";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import { Link as RoutingLink } from "@/i18n/routing";
import FollowUserButton from "@/components/user/FollowUserButton";
import { DownloadLabel } from "@/components/ui/ProjectInfoLabels";
import ProfileLinks from "./ProfileLinks";
import type { ProfileUser } from "./profileData";

type Stats = { totalDownloads: number; nativeDownloads: number; modrinthDownloads: number; curseforgeDownloads: number };

type Props = {
  user: ProfileUser;
  isOwner: boolean;
  isLoggedIn: boolean;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSubscribed: boolean;
  stats: Stats;
};

export default async function ProfileHeader({
  user,
  isOwner,
  isLoggedIn,
  followersCount,
  followingCount,
  isFollowing,
  isSubscribed,
  stats,
}: Props) {
  const tCommon = await getTranslations("Common");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "center", sm: "flex-start" },
        textAlign: { xs: "center", sm: "left" },
        gap: 3,
        mb: { xs: 4, md: 6 },
      }}
    >
      <Avatar src={user.avatarUrl || ""} sx={{ width: { xs: 88, sm: 100 }, height: { xs: 88, sm: 100 }, flexShrink: 0 }} />
      <Box sx={{ flex: 1, width: "100%", minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "center", sm: "flex-start" },
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" }, wordBreak: "break-word", overflowWrap: "anywhere" }}
            >
              {user.displayName || user.username}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              @{user.username}
            </Typography>

            <Box sx={{ mt: 2 }}>
              <FollowUserButton
                targetUsername={user.username}
                targetUserId={user.id}
                initialIsFollowing={isFollowing}
                initialSubscribed={isSubscribed}
                initialFollowersCount={followersCount}
                initialFollowingCount={followingCount}
                isLoggedIn={isLoggedIn}
                isOwner={isOwner}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <DownloadLabel
                    downloads={stats.nativeDownloads}
                    totalDownloads={stats.totalDownloads}
                    externalDownloads={{ native: stats.nativeDownloads, modrinth: stats.modrinthDownloads, curseforge: stats.curseforgeDownloads }}
                    textVariant="body2"
                    textColor="text.primary"
                    iconColor="text.secondary"
                    iconSize={18}
                    sx={{ "& .MuiTypography-root": { fontWeight: 800 } }}
                  />
                </Box>
              </FollowUserButton>
            </Box>
          </Box>

          {isOwner && (
            <RoutingLink href="/settings?tab=profile" prefetch={false} style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="outlined" startIcon={<EditIcon />} size="small" sx={{ whiteSpace: "nowrap" }}>
                {tCommon("edit")}
              </Button>
            </RoutingLink>
          )}
        </Box>

        {user.bio && (
          <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
            {user.bio}
          </Typography>
        )}

        <ProfileLinks user={user} />
      </Box>
    </Box>
  );
}
