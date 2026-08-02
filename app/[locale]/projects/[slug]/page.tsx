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
import { after } from "next/server";
import { favorites, projectSubscriptions, projectMembers, userSettings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import { getProjectDependencies, getProjectDependents } from "@/lib/actions/dependency";
import ProjectDetailHeader from "@/components/project/ProjectDetailHeader";
import ProjectMediaCarousel from "@/components/project/ProjectMediaCarousel";
import { getPublicProjectMedia } from "@/lib/queries/projectMedia";
import ProjectSidebar from "@/components/project/ProjectSidebar";
import ProjectVersionsTable from "@/components/project/ProjectVersionsTable";
import ProjectTabsManager from "@/components/project/ProjectTabsManager";
import ProjectMediaTab from "@/components/project/ProjectMediaTab";
import ProjectDependencies from "@/components/project/ProjectDependencies";
import ProjectComments from "@/components/project/ProjectComments";
import ProjectRecipes from "@/components/project/ProjectRecipes";
import LinkButton from "@/components/ui/LinkButton";
import { recordProjectView } from "@/lib/services/rewardMetrics";
import { resolveClientIp } from "@/lib/rate-limit";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import { toPlainDescription } from "@/lib/utils/plainText";
import AdSlot from "@/components/ads/AdSlot";
import AddIcon from "@mui/icons-material/Add";
import { SITE_URL } from "@/lib/config";
import { canonicalUrl } from "@/lib/seo/canonical";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema, projectSchema } from "@/lib/seo/schema";

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const [project, session] = await Promise.all([
    getProjectBySlug(slug),
    auth(),
  ]);

  if (!project) return { title: "Not Found", robots: { index: false, follow: false } };

  const isOwner = session?.user?.id === project.authorId;
  const isViewable = project.visibility === "public" || project.visibility === "unlisted" || isOwner;

  if (!isViewable) return { title: "Not Found", robots: { index: false, follow: false } };

  const title = `${project.title}`;
  const plainDesc = toPlainDescription(project.body);
  const description = plainDesc.length > 150 ? plainDesc.substring(0, 150) + "..." : plainDesc || "Minecraft Java Edition向けのMOD/プラグイン";
  const imageUrl = project.iconUrl || SITE_URL + "/icon.png";

  // 統合先がある場合は canonical を統合先に向け、重複ページとして扱わせない
  const canonicalSlug = project.redirectSlug || project.slug;
  const url = canonicalUrl(`/projects/${canonicalSlug}`);

  // unlisted / draft / private は URL を知る人だけのものなので検索結果に出さない
  const isIndexable = project.visibility === "public" && !project.redirectSlug;

  return {
    title,
    description,
    robots: isIndexable ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
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
        },
      ],
    },
    alternates: {
      canonical: url,
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
  if (!isOwner && (project.visibility === "private" || project.visibility === "draft")) {
    notFound();
  }

  const db = await getDatabase();
  const [favoritesData, userFavoriteData, dependencies, dependents, userSubscription, media, membership, settingsRecord] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.postId, project.id)).get(),
    session?.user?.id ? db.select().from(favorites).where(and(eq(favorites.postId, project.id), eq(favorites.userId, session.user.id))).get() : null,
    getProjectDependencies(project.id),
    getProjectDependents(project.id),
    session?.user?.id ? db.select().from(projectSubscriptions).where(and(eq(projectSubscriptions.projectId, project.id), eq(projectSubscriptions.userId, session.user.id))).get() : null,
    getPublicProjectMedia(project.id),
    session?.user?.id ? db.select({ userId: projectMembers.userId }).from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get() : null,
    session?.user?.id ? db.select({ defaultCommentBodyFormat: userSettings.defaultCommentBodyFormat }).from(userSettings).where(eq(userSettings.userId, session.user.id)).get() : null,
  ]);

  const featuredMedia = media.filter((m) => m.featured);

  const isSubscribed = !!userSubscription;

  const favoritesCount = favoritesData?.count || 0;

  const cookieStore = await cookies();
  const favCookie = cookieStore.get("favorites")?.value;
  let cookieFavorites: string[] = [];
  if (favCookie) {
    try { cookieFavorites = JSON.parse(favCookie); } catch {}
  }

  const isFavorited = session?.user?.id ? !!userFavoriteData : cookieFavorites.includes(project.id);

  // 還元の配分スコアに使う閲覧数。公開プロジェクトのみ、関係者を除いて数える
  if (project.visibility === "public") {
    // IP はレンダリング中に解決する。after() の中では headers() を読めない
    const clientIp = await resolveClientIp();
    after(() => recordProjectView(project.id, isOwner || !!membership, clientIp));
  }

  if (!project) notFound();

  // getProjectBySlug は ProjectPost を平坦化した形を返す（title / body / visibility）。
  // as any を外して、フィールド名の取りこぼしが型で見つかるようにする。
  const p = project;
  const t = await getTranslations("Project");
  const tNav = await getTranslations("Nav");

  const canEdit = isOwner;

  // ダウンロード数の合算 (ローカル + 外部) はデータベースの totalDownloads を利用する

  // 非公開系はメタデータ側で noindex にしているため構造化データも出さない
  const structuredData = p.visibility === "public"
    ? [
        projectSchema({
          slug: p.slug,
          title: p.title,
          description: toPlainDescription(p.body).slice(0, 300),
          imageUrl: p.iconUrl || SITE_URL + "/icon-512.png",
          authorName: p.author?.displayName || p.author?.username,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }),
        breadcrumbSchema([
          { name: tNav("projects"), path: "/projects" },
          { name: p.title, path: `/projects/${p.slug}` },
        ]),
      ]
    : null;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      {structuredData && <JsonLd data={structuredData} />}
      <Grid container spacing={{ xs: 3, md: 4 }}>
        {/* ---- 左カラム: プロジェクト情報 ---- */}
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

          <ProjectMediaCarousel items={featuredMedia.map((m) => ({ id: m.id, url: m.url, caption: m.caption }))} />

          <ProjectTabsManager
            canEdit={canEdit}
            manageHref={`/projects/${p.slug}/edit`}
            issueTrackerUrl={p.issueTrackerUrl}
            recipesEnabled={p.recipesEnabled}
            mediaContent={
              media.length > 0 ? (
                <ProjectMediaTab media={media} />
              ) : undefined
            }
            recipesContent={
              <Box sx={{ mt: 2 }}>
                <ProjectRecipes projectId={p.id} projectSlug={p.slug} namespaces={p.recipeNamespaces} />
              </Box>
            }
            descriptionContent={
              <Box sx={{ mt: 2 }}>
                <DescriptionRenderer content={p.body} format={p.bodyFormat} />
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
              defaultCommentBodyFormat={settingsRecord?.defaultCommentBodyFormat || "markdown"}
            />
          )}
        </Grid>

        {/* ---- 右カラム: サイドバー ---- */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* 情報カードと広告をまとめて追従させる。個別に sticky にすると
              固定されない側が上を通過して重なるため、必ずこのラッパーで行う */}
          <Box
            sx={{
              position: { md: "sticky" },
              top: { md: 80 },
            }}
          >
            <ProjectSidebar project={p} isAuthenticated={!!session?.user} />
            {/* 作者本人には自分のページの広告を出さない（自己クリックによる
                無効トラフィック扱いを避けるため） */}
            {!isOwner && (
              <Box sx={{ mt: 3, display: { xs: "none", sm: "block" } }}>
                <AdSlot slot="project-sidebar" minHeight={250} />
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
