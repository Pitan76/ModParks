import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { seoAlternates } from "@/lib/seo/canonical";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { listIdeaPosts, countIdeaPosts, toIdeaCardData } from "@/lib/queries/postList";
import { parseIdeaStatuses, parseIdeaSort } from "@/lib/data/ideaFilters";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import LinkButton from "@/components/ui/LinkButton";
import IdeaCardList from "@/components/idea/IdeaCardList";
import IdeaSearchBar from "@/components/idea/IdeaSearchBar";
import PaginationControls from "@/components/ui/PaginationControls";
import AdSlot from "@/components/ads/AdSlot";

const IDEAS_PER_PAGE = 20;

interface IdeasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; sort?: string; author?: string; page?: string; limit?: string }>;
}

/**
 * 検索条件やページ番号の組み合わせで URL が無限に増えるため、
 * canonical は常に絞り込み無しの一覧へ向ける。
 */
export async function generateMetadata({ params }: IdeasPageProps): Promise<Metadata> {
  const { locale } = await params;
  const tIdea = await getTranslations({ locale, namespace: "Idea" });

  return {
    title: tIdea("title"),
    description: tIdea("description"),
    alternates: seoAlternates("/ideas", locale),
  };
}

export default async function IdeasPage({ params, searchParams }: IdeasPageProps) {
  const { locale } = await params;
  const { q, status, sort, author, page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);

  const tIdea = await getTranslations("Idea");
  const tSearch = await getTranslations("Search");

  const db = await getDatabase();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const statuses = parseIdeaStatuses(status);
  const ideaSort = parseIdeaSort(sort);
  const authorId = author === "me" && viewerId ? viewerId : undefined;

  const page = Math.max(1, parseInt(pageStr ?? "") || 1);
  const limit = Math.min(Math.max(parseInt(limitStr ?? "") || IDEAS_PER_PAGE, 10), 80);

  const filters = { viewerId, authorId, q, statuses };
  const [ideaRows, totalCount] = await Promise.all([
    listIdeaPosts(db, { ...filters, sort: ideaSort, limit, offset: (page - 1) * limit }),
    countIdeaPosts(db, filters),
  ]);
  const ideas = ideaRows.map(toIdeaCardData);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }} gutterBottom>
            {tIdea("title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {tIdea("description")}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexShrink: 0, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
          {session && (
            <LinkButton href="/ideas/manage" variant="outlined" sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}>
              {tIdea("goToManage")}
            </LinkButton>
          )}
          <LinkButton href="/ideas/new" variant="contained" startIcon={<AddIcon />} sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}>
            {tIdea("postIdea")}
          </LinkButton>
        </Box>
      </Box>

      <Box sx={{ mb: 3, display: { xs: "none", sm: "block" } }}>
        <AdSlot slot="ideas-top" format="horizontal" maxHeight={100} />
      </Box>

      <IdeaSearchBar initialQ={q} initialStatuses={statuses} initialSort={ideaSort} />

      {ideas.length > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 2, mb: 1 }} />
      )}

      <IdeaCardList
        ideas={ideas}
        headerLeft={
          <Typography variant="body2" color="text.secondary">
            {tIdea("results", { count: totalCount })}
          </Typography>
        }
        emptyContent={
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {q || statuses.length > 0 ? tSearch("noResults") : tIdea("noIdeas")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tIdea("postFirstIdea")}
            </Typography>
          </Box>
        }
        footer={ideas.length > 0 && <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />}
      />
    </Container>
  );
}
