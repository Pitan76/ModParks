import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CardGrid from "@/components/ui/CardGrid";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ProjectCardList from "@/components/project/ProjectCardList";
import ProfileSortSelect from "@/components/profile/ProfileSortSelect";
import CollectionCard from "@/components/list/CollectionCard";
import PaginationControls from "@/components/ui/PaginationControls";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Link as RoutingLink } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/config";
import { canonicalUrl } from "@/lib/seo/canonical";
import IdeaCardList from "@/components/idea/IdeaCardList";
import { getProfileMeta, resolveProfileUser, getProfileContent } from "./profileData";
import ProfileHeader from "./ProfileHeader";
import ProfilePinnedSection from "./ProfilePinnedSection";
import IdeasVisibilityToggle from "./IdeasVisibilityToggle";

interface PublicProfileProps {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PublicProfileProps) {
  const { locale, username } = await params;
  const user = await getProfileMeta(username);
  if (!user || user.deletedAt || user.suspendedAt || user.deactivatedAt) {
    return { title: "Not Found", robots: { index: false, follow: false } };
  }

  const title = `${user.displayName || user.username} (@${user.username})`;
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const description = user.bio || tMeta("profileDescription", { name: user.displayName || user.username });
  const imageUrl = user.avatarUrl || SITE_URL + "/icon.png";
  const image = { url: imageUrl, width: 256, height: 256 };

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", url: canonicalUrl(`/profile/${user.username}`), images: [image] },
    twitter: { card: "summary", title, description, images: [image] },
    alternates: {
      canonical: canonicalUrl(`/profile/${user.username}`),
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

  if (user.suspendedAt) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h5" color="text.secondary">
          {t("accountSuspended")}
        </Typography>
      </Container>
    );
  }

  if (user.deactivatedAt) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h5" color="text.secondary">
          {t("accountDeactivated")}
        </Typography>
      </Container>
    );
  }

  const session = await auth();
  const isOwner = session?.user?.id === user.id;
  const content = await getProfileContent(user, session?.user?.id, isOwner, { limit, offset, sort });
  const { totalCount, visibleProjects, favoritedProjects, userCollections, stats, displayTotalProjects, pinnedItems, authorIdeas, showIdeas } = content;

  const showIdeasSection = isOwner || (showIdeas && authorIdeas.length > 0);

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

      <ProfilePinnedSection items={pinnedItems} />

      {visibleProjects.length > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 2, mb: 1 }} />
      )}

      <ProjectCardList
        projects={visibleProjects}
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
        <CardGrid gap={2}>
          {userCollections.map((c) => (
            <CollectionCard key={c.id} collection={c as any} />
          ))}
        </CardGrid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>{t("noLists")}</Alert>
      )}

      <ProjectCardList
        projects={favoritedProjects}
        storageKey="profileFavoritesLayout"
        defaultLayout="grid"
        headerLeft={
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 0 }}>
            {t("favorites")}
          </Typography>
        }
        emptyContent={<Alert severity="info" sx={{ mt: 2 }}>{t("noFavorites")}</Alert>}
      />

      {showIdeasSection && (
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t("ideas")}
            </Typography>
            {isOwner && <IdeasVisibilityToggle initial={showIdeas} />}
          </Box>
          {authorIdeas.length > 0 ? (
            <IdeaCardList ideas={authorIdeas} />
          ) : (
            <Alert severity="info">{t("noIdeasPosted")}</Alert>
          )}
        </Box>
      )}
    </Container>
  );
}
