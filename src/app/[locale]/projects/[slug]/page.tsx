import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { after } from "next/server";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import { loadProjectDetailPageData } from "@/lib/queries/projectDetailPage";
import { buildProjectDetailMetadata } from "@/lib/seo/projectDetailMetadata";
import ProjectDetailHeader from "@/components/project/ProjectDetailHeader";
import ProjectMediaCarousel from "@/components/project/ProjectMediaCarousel";
import ProjectInfoBox from "@/components/project/ProjectInfoBox";
import ProjectVersionsTable from "@/components/project/ProjectVersionsTable";
import ProjectTabsManager from "@/components/project/ProjectTabsManager";
import ProjectMediaTab from "@/components/project/ProjectMediaTab";
import ProjectDependencies from "@/components/project/ProjectDependencies";
import ProjectComments from "@/components/project/ProjectComments";
import ProjectRecipes from "@/components/project/ProjectRecipes";
import LinkButton from "@/components/ui/LinkButton";
import { recordProjectView } from "@/lib/services/rewardMetrics";
import { resolveClientIp } from "@/lib/rate-limit";
import TranslatedDescription from "@/components/project/TranslatedDescription";
import { resolveDisplayContent } from "@/lib/translation/display";
import { toPlainDescription } from "@/lib/utils/plainText";
import AdSlot from "@/components/ads/AdSlot";
import AddIcon from "@mui/icons-material/Add";
import { SITE_URL } from "@/lib/config";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema, projectSchema } from "@/lib/seo/schema";
import { redirect } from "@/lib/i18n/routing";

/** サイドバーを右カラムに回すのに必要なコンテンツ領域の幅(px) */
const TWO_COLUMN_MIN_WIDTH = 700;

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: ProjectDetailPageProps) {
  const { locale, slug } = await params;
  return buildProjectDetailMetadata({ locale, slug });
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
    redirect({ href: `/projects/${project.redirectSlug}`, locale: locale });
  }

  const isOwner = session?.user?.id === project.authorId;

  // private や draft の場合は作者以外には 404 を返す
  if (!isOwner && (project.visibility === "private" || project.visibility === "draft")) {
    notFound();
  }

  const db = await getDatabase();
  const {
    favoritesCount,
    isFavorited,
    dependencies,
    dependents,
    isSubscribed,
    media,
    featuredMedia,
    membership,
    settingsRecord,
  } = await loadProjectDetailPageData(db, project, session);

  // 還元の配分スコアに使う閲覧数。公開プロジェクトのみ、関係者を除いて数える
  if (project.visibility === "public") {
    // IP はレンダリング中に解決する。after() の中では headers() を読めない
    const clientIp = await resolveClientIp();
    after(() => recordProjectView(project.id, isOwner || !!membership, clientIp));
  }

  if (!project) notFound();

  // 表示ロケールの訳文があれば差し替える。cached はここでは原文のまま返り、
  // 閲覧者の操作でクライアント側に差し込まれる（§9 の索引方針）
  const display = await resolveDisplayContent(db, project, locale);

  // getProjectBySlug は ProjectPost を平坦化した形を返す（title / body / visibility）。
  // as any を外して、フィールド名の取りこぼしが型で見つかるようにする。
  // タイトルは訳さないので原文のまま。本文だけ表示側で切り替える
  const p = project;
  const t = await getTranslations("Project");

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
        }, locale),
        breadcrumbSchema([
          { name: t("explore.title"), path: "/projects" },
          { name: p.title, path: `/projects/${p.slug}` },
        ], locale),
      ]
    : null;

  return (
    <Container maxWidth="lg" sx={{ pt: 1, pb: 3, px: { xs: 2, sm: 3 }, containerType: "inline-size" }}>
      {structuredData && <JsonLd data={structuredData} />}
      {/* 左のナビゲーションサイドバーの開閉で使える幅が変わるため、
          ビューポート幅ではなくコンテナクエリで段組みを切り替える */}
      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: "minmax(0, 1fr)",
          [`@container (min-width: ${TWO_COLUMN_MIN_WIDTH}px)`]: {
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            alignItems:          "start",
          },
        }}
      >
        {/* ---- 左カラム: プロジェクト情報 ---- */}
        <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
          
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
              <Box>
                <ProjectRecipes projectId={p.id} projectSlug={p.slug} namespaces={p.recipeNamespaces} settings={p.recipeSettings} />
              </Box>
            }
            descriptionContent={
              <Box>
                <TranslatedDescription
                  postId={p.id}
                  locale={locale}
                  original={{ body: p.body, format: p.bodyFormat }}
                  translation={display.translated
                    ? { body: display.body, format: display.bodyFormat }
                    : null}
                  state={display.state}
                  stale={display.stale}
                  canTranslate={display.canTranslate}
                  isLoggedIn={!!session?.user?.id}
                />
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
        </Box>

        {/* ---- 右カラム: サイドバー ---- */}
        <Box>
          {/* 情報カードと広告をまとめて追従させる。個別に sticky にすると
              固定されない側が上を通過して重なるため、必ずこのラッパーで行う */}
          <Box
            sx={{
              [`@container (min-width: ${TWO_COLUMN_MIN_WIDTH}px)`]: {
                position: "sticky",
                top:      80,
              },
            }}
          >
            <ProjectInfoBox project={p} isAuthenticated={!!session?.user} />
            {/* 作者本人には自分のページの広告を出さない（自己クリックによる
                無効トラフィック扱いを避けるため） */}
            {!isOwner && (
              <Box sx={{ mt: 3, display: { xs: "none", sm: "block" } }}>
                <AdSlot slot="project-sidebar" minHeight={250} />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
