import { notFound, redirect } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TwitterIcon from "@mui/icons-material/Twitter";
import InstagramIcon from "@mui/icons-material/Instagram";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import ProjectCard from "@/components/project/ProjectCard";
import ProfileSortSelect from "@/components/profile/ProfileSortSelect";
import { getProjects } from "@/lib/actions/project";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { getUserCollections } from "@/lib/actions/collection";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import { Link as RoutingLink } from "@/i18n/routing";
import { SITE_URL } from "@/lib/config";
import { userFollows } from "@/db/schema";
import { and, sql } from "drizzle-orm";
import FollowUserButton from "@/components/user/FollowUserButton";
import CollectionCard from "@/components/list/CollectionCard";
import { formatCompactNumber } from "@/lib/utils/format";
import PaginationControls from "@/components/ui/PaginationControls";
import Tooltip from "@mui/material/Tooltip";
import { DownloadLabel } from "@/components/ui/ProjectInfoLabels";

interface PublicProfileProps {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getLinkIcon(url: string) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("x.com")) return <XIcon fontSize="small" />;
    if (hostname.includes("twitter.com")) return <TwitterIcon fontSize="small" />;
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return <YouTubeIcon fontSize="small" />;
    if (hostname.includes("instagram.com")) return <InstagramIcon fontSize="small" />;
    if (hostname.includes("github.com")) return <GitHubIcon fontSize="small" />;
    if (hostname.includes("curseforge.com")) return <Box component="img" src="https://www.curseforge.com/favicon.ico" sx={{ width: 16, height: 16, mr: 0.5 }} />;
    if (hostname.includes("modrinth.com")) return <Box component="img" src="https://modrinth.com/favicon.ico" sx={{ width: 16, height: 16, mr: 0.5 }} />;
  } catch (e) {
    // Ignore invalid URL
  }
  return <LinkIcon fontSize="small" />;
}

export async function generateMetadata({ params }: PublicProfileProps) {
  const { username } = await params;
  const d1 = await getD1();
  const db = getDb(d1);
  const user = await db.select({
    username: userProfiles.username,
    displayName: userProfiles.displayName,
    bio: userProfiles.bio,
    avatarUrl: userProfiles.avatarUrl,
    deletedAt: users.deletedAt
  }).from(users).innerJoin(userProfiles, eq(users.id, userProfiles.userId)).where(eq(userProfiles.username, username)).get();

  if (!user || user.deletedAt) {
    return { title: "Not Found" };
  }

  const title = `${user.displayName || user.username} (@${user.username})`;
  const description = user.bio || `${user.displayName || user.username} のプロフィールページです。`;
  const imageUrl = user.avatarUrl || SITE_URL + "/icon.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: SITE_URL + `/profile/${user.username}`,
      images: [
        {
          url: imageUrl,
          width: 256,
          height: 256,
          alt: `${user.username} Avatar`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 256,
          height: 256,
          alt: `${user.username} Avatar`,
        },
      ],
    },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfileProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page as string) || 1;
  const limit = Math.min(Math.max(parseInt(resolvedSearchParams.limit as string) || 20, 10), 80);
  const offset = (page - 1) * limit;

  const t = await getTranslations("Profile");
  const tCommon = await getTranslations("Common");

  const d1 = await getD1();
  const db = getDb(d1);

  let user = await db.select({
    id: users.id,
    username: userProfiles.username,
    displayName: userProfiles.displayName,
    avatarUrl: userProfiles.avatarUrl,
    bio: userProfiles.bio,
    links: userProfiles.links,
    githubUsername: userProfiles.githubUsername,
    custom: userSettings.custom,
    deletedAt: users.deletedAt,
  }).from(users)
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(userSettings, eq(users.id, userSettings.userId))
    .where(eq(userProfiles.username, username)).get();

  // If not found, check previousUsername
  if (!user) {
    const prevUser = await db.select({ username: userProfiles.username }).from(userProfiles).where(eq(userProfiles.previousUsername, username)).get();
    if (prevUser && prevUser.username) {
      redirect(`/${locale}/profile/${prevUser.username}`);
    }
    notFound();
  }

  // Soft deleted user check
  if (user.deletedAt) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h5" color="text.secondary">
          {t("accountDeleted")}
        </Typography>
      </Container>
    );
  }

  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  const followersData = await db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followingId, user.id)).get();
  const followersCount = followersData?.count || 0;

  const followingData = await db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followerId, user.id)).get();
  const followingCount = followingData?.count || 0;

  let isFollowing = false;
  if (session?.user?.id && !isOwner) {
    const followRecord = await db.select().from(userFollows).where(and(eq(userFollows.followerId, session.user.id), eq(userFollows.followingId, user.id))).get();
    if (followRecord) {
      isFollowing = true;
    }
  }

  const sort = (resolvedSearchParams.sort as string) || "updated";
  
  // Fetch user projects and favorites
  const [{ data: allProjects, totalCount }, favoritedProjects, userCollections, { totalProjects, totalDownloads, nativeDownloads, modrinthDownloads, curseforgeDownloads }] = await Promise.all([
    getProjects({ authorId: user.id, limit, offset, sort: sort as any, calculateTotal: true }),
    getFavoriteProjects(user.id),
    getUserCollections(user.id, session?.user?.id),
    import("@/lib/actions/project").then(m => m.getUserProjectStats(user.id))
  ]);
  const visibleProjects = allProjects.filter(p => isOwner ? true : p.status === "public");

  // If owner, totalProjects can be totalCount from DB, else use public stats
  const displayTotalProjects = isOwner ? totalCount : totalProjects;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
        <Avatar src={user.avatarUrl || ""} sx={{ width: 100, height: 100 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
                {user.displayName || user.username}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                @{user.username}
              </Typography>

              <Box sx={{ mt: 2 }}>
                <FollowUserButton
                  targetUsername={user.username}
                  initialIsFollowing={isFollowing}
                  initialFollowersCount={followersCount}
                  initialFollowingCount={followingCount}
                  isLoggedIn={!!session?.user}
                  isOwner={isOwner}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <DownloadLabel 
                      downloads={nativeDownloads} 
                      totalDownloads={totalDownloads} 
                      externalDownloads={{ native: nativeDownloads, modrinth: modrinthDownloads, curseforge: curseforgeDownloads }} 
                      textVariant="body2" 
                      textColor="text.primary" 
                      iconColor="text.secondary"
                      iconSize={18} 
                      sx={{ '& .MuiTypography-root': { fontWeight: 800 } }}
                    />
                  </Box>
                </FollowUserButton>
              </Box>
            </Box>

            {isOwner && (
              <RoutingLink href="/settings?tab=profile" style={{ textDecoration: "none", flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  size="small"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {t("edit")}
                </Button>
              </RoutingLink>
            )}
          </Box>

          {user.bio && (
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
              {user.bio}
            </Typography>
          )}

          {(() => {
            let parsedLinks: any[] = [];
            try {
              if (user.links) {
                const parsed = JSON.parse(user.links);
                if (Array.isArray(parsed)) parsedLinks = parsed;
              }
            } catch {}

            const showGithub = user.githubUsername && ((user.custom as Record<string, any>)?.showGithubLink ?? true);

            if (parsedLinks.length === 0 && !showGithub) return null;

            return (
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 2 }}>
                {showGithub && (
                  <Link
                    href={`https://github.com/${user.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
                  >
                    <GitHubIcon fontSize="small" />
                    {user.githubUsername}
                  </Link>
                )}
                {parsedLinks.map((link: any, i: number) => (
                  <Link
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
                  >
                    {getLinkIcon(link.url)}
                    {link.title || link.url}
                  </Link>
                ))}
              </Box>
            );
          })()}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0 }}>
          {t("projects")} <Box component="span" sx={{ color: "text.secondary", fontSize: "1.1rem", fontWeight: "normal", ml: 0.5 }}>({displayTotalProjects})</Box>
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <ProfileSortSelect />
          {isOwner && (
            <RoutingLink href="/projects?author=me" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                sx={{ height: '100%' }}
              >
                {t("manage")}
              </Button>
            </RoutingLink>
          )}
        </Box>
      </Box>

      {visibleProjects.length > 0 ? (
        <>
          <Grid container spacing={2}>
            {visibleProjects.map(p => (
              <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <ProjectCard project={p as any} layout="grid" />
              </Grid>
            ))}
          </Grid>

          <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />
        </>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t("noProjects")}
        </Alert>
      )}

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        {t("lists")}
      </Typography>

      {userCollections.length > 0 ? (
        <Grid container spacing={2}>
          {userCollections.map(c => (
            <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CollectionCard collection={c as any} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t("noLists")}
        </Alert>
      )}

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        {t("favorites")}
      </Typography>

      {favoritedProjects.length > 0 ? (
        <Grid container spacing={2}>
          {favoritedProjects.map(p => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p as any} layout="grid" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t("noFavorites")}
        </Alert>
      )}
    </Container>
  );
}
