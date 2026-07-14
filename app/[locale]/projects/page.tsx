import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ProjectCardList from "@/components/project/ProjectCardList";
import LinkButton from "@/components/ui/LinkButton";
import ProjectSearchBar from "@/components/project/ProjectSearchBar";
import { getProjects } from "@/lib/actions/project";
import { auth } from "@/lib/auth";
import PaginationControls from "@/components/ui/PaginationControls";
import AdSlot from "@/components/ads/AdSlot";

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

  const authorId = author === "me" && session?.user?.id ? session.user.id : undefined;
  const authorUsername = author !== "me" && author ? author : undefined;

  const typesArr = types ? types.split(",") : ["mod", "plugin", "resourcepack", "datapack", "shader", "modpack"];
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
    authorUsername,
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

  const { getAvailableTags, getAvailablePlatforms } = await import("@/lib/queries/masterData");
  const [availableTags, availablePlatforms] = await Promise.all([
    getAvailableTags(),
    getAvailablePlatforms(),
  ]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      {/* ページタイトル */}
      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }} gutterBottom>
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
              sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}
            >
              {tProject("goToManage")}
            </LinkButton>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <AdSlot slot="projects-top" />
      </Box>

      {/* 検索バー */}
      <ProjectSearchBar
        initialQ={q} 
        initialAuthor={author}
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

      {/* プロジェクト一覧 */}
      <ProjectCardList
        projects={filtered as any}
        storageKey="projectsListLayout"
        headerLeft={
          <Typography variant="body2" color="text.secondary">
            {tSearch("results", { count: totalCount })}
          </Typography>
        }
        emptyContent={
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Typography variant="h6" color="text.secondary">
              {tSearch("noResults")}
            </Typography>
          </Box>
        }
        footer={
          filtered.length > 0 && (
            <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />
          )
        }
      />
    </Container>
  );
}
