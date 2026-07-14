import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { projectFavorites, projectSubscriptions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getProjectBySlug } from "@/lib/actions/project";
import { getProjectDependencies, getProjectDependents } from "@/lib/actions/dependency";
import ProjectDetailHeader from "@/components/project/ProjectDetailHeader";
import ProjectSidebar from "@/components/project/ProjectSidebar";
import ProjectVersionsTable from "@/components/project/ProjectVersionsTable";
import ProjectTabsManager from "@/components/project/ProjectTabsManager";
import ProjectDependencies from "@/components/project/ProjectDependencies";
import ProjectComments from "@/components/project/ProjectComments";
import LinkButton from "@/components/ui/LinkButton";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import AdSlot from "@/components/ads/AdSlot";
import AddIcon from "@mui/icons-material/Add";
import { SITE_URL } from "@/lib/config";

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    return { title: "Not Found" };
  }

  const title = `${project.name}`;
  const description = project.description || "Minecraft Java Edition向けのMOD/プラグイン";
  const imageUrl = project.iconUrl || SITE_URL + "/icon.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: SITE_URL + `/projects/${project.slug}`,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
          alt: `${project.name} Icon`,
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
          width: 512,
          height: 512,
          alt: `${project.name} Icon`,
        },
      ],
    },
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [project, session] = await Promise.all([
    getProjectBySlug(slug),
    auth(),
  ]);

  if (!project) notFound();
  
  if (project.redirectSlug) {
    const { redirect } = await import("next/navigation");
    redirect(`/${locale}/projects/${project.redirectSlug}`);
  }

  const isOwner = session?.user?.id === project.authorId;

  // private や draft の場合は作者以外には 404 を返す
  if (!isOwner && (project.status === "private" || project.status === "draft")) {
    notFound();
  }

  const db = await getDatabase();
  const [favoritesData, userFavoriteData, dependencies, dependents, userSubscription] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectFavorites).where(eq(projectFavorites.projectId, project.id)).get(),
    session?.user?.id ? db.select().from(projectFavorites).where(and(eq(projectFavorites.projectId, project.id), eq(projectFavorites.userId, session.user.id))).get() : null,
    getProjectDependencies(project.id),
    getProjectDependents(project.id),
    session?.user?.id ? db.select().from(projectSubscriptions).where(and(eq(projectSubscriptions.projectId, project.id), eq(projectSubscriptions.userId, session.user.id))).get() : null,
  ]);

  const isSubscribed = !!userSubscription;

  const favoritesCount = favoritesData?.count || 0;

  const cookieStore = await cookies();
  const favCookie = cookieStore.get("favorites")?.value;
  let cookieFavorites: string[] = [];
  if (favCookie) {
    try { cookieFavorites = JSON.parse(favCookie); } catch {}
  }

  const isFavorited = session?.user?.id ? !!userFavoriteData : cookieFavorites.includes(project.id);

  if (!project) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = project as any;
  const t = await getTranslations("Project");

  const canEdit = isOwner;

  // ダウンロード数の合算 (ローカル + 外部) はデータベースの totalDownloads を利用する

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Grid container spacing={{ xs: 3, md: 4 }}>
        {/* ─── 左カラム: プロジェクト情報 ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ minWidth: 0, maxWidth: "100%" }}>
          
          <ProjectDetailHeader 
            project={p} 
            canEdit={canEdit} 
            isLoggedIn={!!session?.user}
            currentUserId={session?.user?.id}
            isFavorited={isFavorited}
            favoritesCount={favoritesCount}
            isSubscribed={isSubscribed}
          />

          <ProjectTabsManager 
            canEdit={canEdit}
            manageHref={`/projects/${p.slug}/edit`}
            issueTrackerUrl={p.issueTrackerUrl}
            descriptionContent={
              <Box sx={{ mt: 2 }}>
                <DescriptionRenderer content={p.description || ""} format={p.descriptionFormat || "markdown"} />
              </Box>
            }
            filesContent={
              <Box>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t("versions")}
                  </Typography>
                  {canEdit && (
                    <LinkButton
                      variant="contained"
                      startIcon={<AddIcon />}
                      href={`/projects/${p.slug}/versions/new`}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {t("header.addVersion")}
                    </LinkButton>
                  )}
                </Box>

                {p.versions.length > 0 ? (
                  <ProjectVersionsTable versions={p.versions} projectSlug={slug} />
                ) : (
                  <Typography color="text.secondary">{t("noVersions")}</Typography>
                )}
              </Box>
            }
            dependenciesContent={
              <ProjectDependencies dependencies={dependencies} dependents={dependents} />
            }
          />

          {p.commentsEnabled && (
            <ProjectComments 
              projectSlug={p.slug} 
              isLoggedIn={!!session?.user} 
              currentUserId={session?.user?.id} 
            />
          )}
        </Grid>

        {/* ─── 右カラム: サイドバー ─────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <ProjectSidebar project={p} isAuthenticated={!!session?.user} />
          <Box sx={{ mt: 3 }}>
            <AdSlot slot="project-sidebar" minHeight={250} />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
