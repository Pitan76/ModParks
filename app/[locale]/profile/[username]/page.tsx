import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ProjectCardList from "@/components/project/ProjectCardList";
import ProfileSortSelect from "@/components/profile/ProfileSortSelect";
import CollectionCard from "@/components/list/CollectionCard";
import PaginationControls from "@/components/ui/PaginationControls";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Link as RoutingLink } from "@/i18n/routing";
import { SITE_URL } from "@/lib/config";
import { getProfileMeta, resolveProfileUser, getProfileContent } from "./profileData";
import ProfileHeader from "./ProfileHeader";

interface PublicProfileProps {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PublicProfileProps) {
  const { locale, username } = await params;
  const user = await getProfileMeta(username);
  if (!user || user.deletedAt) return { title: "Not Found" };

  const title = `${user.displayName || user.username} (@${user.username})`;
  const description = user.bio || `${user.displayName || user.username} のプロフィールページです。`;
  const imageUrl = user.avatarUrl || SITE_URL + "/icon.png";
  const image = { url: imageUrl, width: 256, height: 256, alt: `${user.username} Avatar` };

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", url: SITE_URL + `/${locale}/profile/${user.username}`, images: [image] },
    twitter: { card: "summary", title, description, images: [image] },
    alternates: {
      canonical: `${SITE_URL}/${locale}/profile/${user.username}`,
      languages: { ja: `${SITE_URL}/ja/profile/${user.username}`, en: `${SITE_URL}/en/profile/${user.username}` },
    },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfileProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const page = parseInt(sp.page as string) || 1;
  const limit = Math.min(Math.max(parseInt(sp.limit as string) || 20, 10), 80);
  const offset = (page - 1) * limit;
  const sort = (sp.sort as string) || "updated";

  const t = await getTranslations("Profile");

  const resolved = await resolveProfileUser(username);
  if (!resolved) notFound();
  if ("redirectTo" in resolved) redirect(`/${locale}/profile/${resolved.redirectTo}`);

  const { user } = resolved;
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
  const content = await getProfileContent(user, session?.user?.id, isOwner, { limit, offset, sort });
  const { totalCount, visibleProjects, favoritedProjects, userCollections, stats, displayTotalProjects } = content;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <ProfileHeader
        user={user}
        isOwner={isOwner}
        isLoggedIn={!!session?.user}
        followersCount={content.followersCount}
        followingCount={content.followingCount}
        isFollowing={content.isFollowing}
        isSubscribed={content.isSubscribed}
        stats={stats}
      />

      {visibleProjects.length > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 2, mb: 1 }} />
      )}

      <ProjectCardList
        projects={visibleProjects as any}
        storageKey="profileProjectsLayout"
        defaultLayout="grid"
        headerLeft={
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0, fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>
            {t("projects")}{" "}
            <Box component="span" sx={{ color: "text.secondary", fontSize: "1.1rem", fontWeight: "normal", ml: 0.5 }}>
              ({displayTotalProjects})
            </Box>
          </Typography>
        }
        headerRight={
          <>
            <ProfileSortSelect />
            {isOwner && (
              <RoutingLink href="/projects?author=me" prefetch={false} style={{ textDecoration: "none" }}>
                <Button variant="outlined" size="small" sx={{ height: "100%" }}>
                  {t("manage")}
                </Button>
              </RoutingLink>
            )}
          </>
        }
        emptyContent={<Alert severity="info" sx={{ mt: 2 }}>{t("noProjects")}</Alert>}
        footer={visibleProjects.length > 0 && <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />}
      />

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        {t("lists")}
      </Typography>

      {userCollections.length > 0 ? (
        <Grid container spacing={2}>
          {userCollections.map((c) => (
            <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CollectionCard collection={c as any} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>{t("noLists")}</Alert>
      )}

      <ProjectCardList
        projects={favoritedProjects as any}
        storageKey="profileFavoritesLayout"
        defaultLayout="grid"
        headerLeft={
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 0 }}>
            {t("favorites")}
          </Typography>
        }
        emptyContent={<Alert severity="info" sx={{ mt: 2 }}>{t("noFavorites")}</Alert>}
      />
    </Container>
  );
}
