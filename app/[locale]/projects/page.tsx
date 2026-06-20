import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ProjectCard from "@/components/project/ProjectCard";
import LinkButton from "@/components/ui/LinkButton";
import ProjectSearchBar from "@/components/project/ProjectSearchBar";
import { getProjects } from "@/lib/actions/project";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/routing";
import PaginationControls from "@/components/ui/PaginationControls";

interface ProjectsPageProps {
  params:      Promise<{ locale: string }>;
  searchParams: Promise<{ 
    q?: string; types?: string; author?: string; sort?: string; loaders?: string; mcVersions?: string; tags?: string;
    searchMode?: string; includeDesc?: string; includeTags?: string; includeAuthor?: string; includeExtDl?: string;
    page?: string; limit?: string;
  }>;
}

export default async function ProjectsPage({ params, searchParams }: ProjectsPageProps) {
  const { locale } = await params;
  const { 
    q, types, author, sort, loaders, mcVersions, tags,
    searchMode, includeDesc, includeTags, includeAuthor, includeExtDl,
    page: pageStr, limit: limitStr
  } = await searchParams;
  setRequestLocale(locale);

  const tSearch = await getTranslations("Search");
  const tProject = await getTranslations("Project");
  const session = await auth();

  // /projects?author=me の場合は自分のプロジェクトのみ（下書き含む）を取得
  const authorId = author === "me" && session?.user?.id ? session.user.id : undefined;

  const typesArr = types ? types.split(",") : ["mod", "plugin"];
  const loadersArr = loaders ? loaders.split(",") : undefined;
  const mcVersionsArr = mcVersions ? mcVersions.split(",") : undefined;
  const tagsArr = tags ? tags.split(",") : undefined;

  const isIncludeDesc = includeDesc !== "false";
  const isIncludeTags = includeTags !== "false";
  const isIncludeAuthor = includeAuthor !== "false";
  const isIncludeExtDl = includeExtDl === "true";
  const sm = searchMode === "AND" ? "AND" : "OR";

  const page = parseInt(pageStr as string) || 1;
  const limit = Math.min(Math.max(parseInt(limitStr as string) || 20, 10), 80);
  const offset = (page - 1) * limit;

  // フィルタリング
  const { data: filtered, totalCount } = await getProjects({
    q,
    types: typesArr,
    authorId,
    sort: sort as any,
    loaders: loadersArr,
    mcVersions: mcVersionsArr,
    tags: tagsArr,
    searchMode: sm,
    includeDesc: isIncludeDesc,
    includeTags: isIncludeTags,
    includeAuthor: isIncludeAuthor,
    includeExtDl: isIncludeExtDl,
    limit,
    offset,
    calculateTotal: true,
  });

  const { getDatabase } = await import("@/lib/db");
  const { tags: tagsTable, platforms: platformsTable } = await import("@/db/schema");
  const db = await getDatabase();
  const availableTags = await db.select({ slug: tagsTable.slug, name: tagsTable.name }).from(tagsTable).all();
  const availablePlatforms = await db.select({ slug: platformsTable.slug, name: platformsTable.name }).from(platformsTable).all();

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      {/* ページタイトル */}
      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }} gutterBottom>
            {author === "me" ? tProject("myProjects.title") : tProject("explore.title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {author === "me" 
              ? tProject("myProjects.description") 
              : tProject("explore.description")}
          </Typography>
        </Box>
        
        {author === "me" && (
          <Box sx={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <LinkButton
              href="/projects/manage"
              variant="contained"
              sx={{ flexShrink: 0 }}
            >
              プロジェクト管理画面へ
            </LinkButton>
          </Box>
        )}
      </Box>

      {/* 検索バー */}
      <ProjectSearchBar 
        initialQ={q} 
        initialTypes={typesArr} 
        initialSort={sort}
        initialLoaders={loadersArr || []}
        initialMcVersions={mcVersionsArr || []}
        initialTags={tagsArr || []}
        initialSearchMode={sm}
        initialIncludeDesc={isIncludeDesc}
        initialIncludeTags={isIncludeTags}
        initialIncludeAuthor={isIncludeAuthor}
        initialIncludeExtDl={isIncludeExtDl}
        availableTags={availableTags}
        availablePlatforms={availablePlatforms}
      />

      {/* 件数表示 */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {tSearch("results", { count: totalCount })}
        </Typography>
      </Box>

      {/* プロジェクト一覧 */}
      {filtered.length > 0 ? (
        <>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project as any} />
            ))}
          </Box>
          <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />
        </>
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6" color="text.secondary">
            {tSearch("noResults")}
          </Typography>
        </Box>
      )}
    </Container>
  );
}
