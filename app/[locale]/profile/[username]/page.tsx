import { notFound, redirect } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import DiscordIcon from "@mui/icons-material/Discord";
import TwitterIcon from "@mui/icons-material/Twitter";
import InstagramIcon from "@mui/icons-material/Instagram";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import ProjectCard from "@/components/project/ProjectCard";
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

interface PublicProfileProps {
  params: Promise<{ locale: string; username: string }>;
}

function getLinkIcon(url: string) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("x.com")) return <XIcon fontSize="small" />;
    if (hostname.includes("twitter.com")) return <TwitterIcon fontSize="small" />;
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return <YouTubeIcon fontSize="small" />;
    if (hostname.includes("instagram.com")) return <InstagramIcon fontSize="small" />;
    if (hostname.includes("github.com")) return <GitHubIcon fontSize="small" />;
    if (hostname.includes("discord.gg") || hostname.includes("discord.com")) return <DiscordIcon fontSize="small" />;
  } catch (e) {
    // Ignore invalid URL
  }
  return <LinkIcon fontSize="small" />;
}

export async function generateMetadata({ params }: PublicProfileProps) {
  const { username } = await params;
  const d1 = await getD1();
  const db = getDb(d1);
  const user = await db.select().from(users).where(eq(users.username, username)).get();

  if (!user || user.deletedAt) {
    return { title: "Not Found | ModParks" };
  }

  const title = `${user.displayName || user.username} (@${user.username}) | ModParks`;
  const description = user.bio || `${user.displayName || user.username} のプロフィールページです。`;
  const imageUrl = user.avatarUrl || "https://modparks.pages.dev/icon.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `https://modparks.pages.dev/profile/${user.username}`,
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
      images: [imageUrl],
    },
  };
}

export default async function PublicProfilePage({ params }: PublicProfileProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Profile");

  const d1 = await getD1();
  const db = getDb(d1);

  let user = await db.select().from(users).where(eq(users.username, username)).get();

  // If not found, check previousUsername
  if (!user) {
    const prevUser = await db.select().from(users).where(eq(users.previousUsername, username)).get();
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

  // Fetch user projects and favorites
  const [allProjects, favoritedProjects, userCollections] = await Promise.all([
    getProjects({ authorId: user.id }),
    getFavoriteProjects(user.id),
    getUserCollections(user.id, session?.user?.id)
  ]);
  const visibleProjects = allProjects.filter(p => isOwner ? true : p.status === "public");

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
        <Avatar src={user.avatarUrl || ""} sx={{ width: 100, height: 100 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {user.displayName || user.username}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                @{user.username}
              </Typography>
            </Box>
            
            {isOwner && (
              <RoutingLink href="/settings?tab=profile" style={{ textDecoration: "none" }}>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  size="small"
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

          {user.links && (() => {
            try {
              const parsedLinks = JSON.parse(user.links);
              if (!Array.isArray(parsedLinks) || parsedLinks.length === 0) return null;
              return (
                <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 2 }}>
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
            } catch {
              return null;
            }
          })()}

          {user.githubUsername && user.showGithubLink && (
            <Box sx={{ mt: 1 }}>
              <Link
                href={`https://github.com/${user.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
              >
                <GitHubIcon fontSize="small" />
                {user.githubUsername}
              </Link>
            </Box>
          )}
        </Box>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        {t("projects")}
      </Typography>
      
      {visibleProjects.length > 0 ? (
        <Grid container spacing={2}>
          {visibleProjects.map(p => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p as any} layout="grid" />
            </Grid>
          ))}
        </Grid>
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
              <RoutingLink
                href={`/lists/${c.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <Box
                  sx={{
                    p: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      transform: "translateY(-2px)"
                    }
                  }}
                >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    {c.name}
                  </Typography>
                  <Chip 
                    label={t(`visibility.${c.visibility}`)} 
                    size="small"
                    variant="outlined"
                    color={c.visibility === "public" ? "primary" : "default"}
                  />
                </Box>
                {c.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {c.description}
                  </Typography>
                )}
                </Box>
              </RoutingLink>
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
