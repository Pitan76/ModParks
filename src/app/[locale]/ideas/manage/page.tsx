import { setRequestLocale, getTranslations } from "next-intl/server";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumb from "@/components/ui/Breadcrumb";
import AddIcon from "@mui/icons-material/Add";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { listIdeaPosts, countIdeaPosts } from "@/lib/queries/postList";
import LinkButton from "@/components/ui/LinkButton";
import BatchIdeaOperationsClient from "@/components/idea/BatchIdeaOperationsClientLazy";
import PaginationControls from "@/components/ui/PaginationControls";
import { redirect } from "@/lib/i18n/routing";
import { getAvailableTags, getAvailablePlatforms } from "@/lib/queries/masterData";

const MANAGE_IDEAS_PER_PAGE = 50;

interface ManageIdeasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function ManageIdeasPage({ params, searchParams }: ManageIdeasPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();

  if (!session?.user?.id) {
    redirect({ href: `/login`, locale: locale });
  }

  const tIdea = await getTranslations("Idea");
  const tCommon = await getTranslations("Common");

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || MANAGE_IDEAS_PER_PAGE, 10), 200);
  const offset = (page - 1) * limit;

  const db = await getDatabase();

  const [ideas, totalCount, availableTags, availablePlatforms] = await Promise.all([
    listIdeaPosts(db, { viewerId: session.user.id, authorId: session.user.id, includeHidden: true, limit, offset }),
    countIdeaPosts(db, { viewerId: session.user.id, authorId: session.user.id, includeHidden: true }),
    getAvailableTags(),
    getAvailablePlatforms(),
  ]);

  return (
    <Container maxWidth="lg" sx={{ pt: 1, pb: 3, px: { xs: 2, sm: 3 } }}>
      <Breadcrumb
        items={[
          { label: tCommon("ideas"), href: "/ideas" },
          { label: tIdea("manageTitle") },
        ]}
      />

      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
            {tIdea("manageTitle")}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexShrink: 0, flexWrap: "wrap" }}>
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

      <BatchIdeaOperationsClient
        ideas={ideas}
        availableTags={availableTags}
        availablePlatforms={availablePlatforms}
      />
      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 3 }} />
      )}
    </Container>
  );
}
