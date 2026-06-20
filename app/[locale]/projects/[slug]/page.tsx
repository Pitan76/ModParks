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
import { projectFavorites } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getProjectBySlug } from "@/lib/actions/project";
import ProjectDetailHeader from "@/components/project/ProjectDetailHeader";
import ProjectSidebar from "@/components/project/ProjectSidebar";
import ProjectVersionsTable from "@/components/project/ProjectVersionsTable";
import ProjectTabsManager from "@/components/project/ProjectTabsManager";
import ProjectComments from "@/components/project/ProjectComments";
import LinkButton from "@/components/ui/LinkButton";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
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
  const description = project.description || "Minecraft Java Edition向けのMod/Plugin";
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
      images: [imageUrl],
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

  const isOwner = session?.user?.id === project.authorId;

  // private や draft の場合は作者以外には 404 を返す
  if (!isOwner && (project.status === "private" || project.status === "draft")) {
    notFound();
  }

  const db = await getDatabase();
  const [favoritesData, userFavoriteData] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectFavorites).where(eq(projectFavorites.projectId, project.id)).get(),
    session?.user?.id ? db.select().from(projectFavorites).where(and(eq(projectFavorites.projectId, project.id), eq(projectFavorites.userId, session.user.id))).get() : null
  ]);

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

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Grid container spacing={4}>
        {/* ─── 左カラム: プロジェクト情報 ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ minWidth: 0, maxWidth: "100%" }}>
          
          <ProjectDetailHeader 
            project={p} 
            canEdit={canEdit} 
            isLoggedIn={!!session?.user}
            currentUserId={session?.user?.id}
            isFavorited={isFavorited}
            favoritesCount={favoritesCount}
          />

          <ProjectTabsManager 
            canEdit={canEdit}
            manageHref={`/projects/${p.slug}/edit`}
            descriptionContent={
              <Box sx={{ p: 1 }}>
                <MarkdownRenderer content={p.description || ""} />
              </Box>
            }
            filesContent={
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t("versions")}
                  </Typography>
                  {canEdit && (
                    <LinkButton
                      variant="contained"
                      startIcon={<AddIcon />}
                      href={`/projects/${p.slug}/versions/new`}
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
        </Grid>
      </Grid>
    </Container>
  );
}
