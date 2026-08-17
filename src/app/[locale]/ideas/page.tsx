import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { seoAlternates } from "@/lib/seo/canonical";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { listIdeaPosts, countIdeaPosts, toIdeaCardData } from "@/lib/queries/postList";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import LinkButton from "@/components/ui/LinkButton";
import IdeaCardList from "@/components/idea/IdeaCardList";
import PaginationControls from "@/components/ui/PaginationControls";

const IDEAS_PER_PAGE = 20;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: "Nav" });

  return {
    title: tNav("ideas"),
    alternates: seoAlternates("/ideas", locale),
  };
}

interface IdeasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function IdeasPage({ params, searchParams }: IdeasPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const tIdea = await getTranslations("Idea");

  const db = await getDatabase();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || IDEAS_PER_PAGE, 10), 80);
  const offset = (page - 1) * limit;

  const [ideaRows, totalCount] = await Promise.all([
    listIdeaPosts(db, { viewerId, limit, offset }),
    countIdeaPosts(db, { viewerId }),
  ]);
  const allIdeas = ideaRows.map(toIdeaCardData);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2, mb: 4 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
            {tIdea("title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {tIdea("description")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexShrink: 0, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
          {session && (
            <LinkButton
              href="/ideas/manage"
              variant="outlined"
              sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}
            >
              {tIdea("goToManage")}
            </LinkButton>
          )}
          <LinkButton
            href="/ideas/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}
          >
            {tIdea("postIdea")}
          </LinkButton>
        </Box>
      </Box>

      <IdeaCardList ideas={allIdeas} />

      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 4 }} />
      )}
    </Container>
  );
}
