import { setRequestLocale, getTranslations } from "next-intl/server";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumb from "@/components/ui/Breadcrumb";
import AddIcon from "@mui/icons-material/Add";
import { auth } from "@/lib/auth";
import { getProjects, getProjectCount } from "@/lib/actions/projectQuery";
import LinkButton from "@/components/ui/LinkButton";
import BatchProjectOperationsClient from "@/components/project/BatchProjectOperationsClientLazy";
import PaginationControls from "@/components/ui/PaginationControls";
import { getAvailablePlatforms } from "@/lib/queries/masterData";
import { redirect } from "@/lib/i18n/routing";

const MANAGE_PROJECTS_PER_PAGE = 50;

interface ManageProjectsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function ManageProjectsPage({ params, searchParams }: ManageProjectsPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();

  if (!session?.user?.id) {
    redirect({ href: `/login`, locale: locale });
  }

  const tProject = await getTranslations("Project");
  const tCommon = await getTranslations("Common");

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || MANAGE_PROJECTS_PER_PAGE, 10), 200);
  const offset = (page - 1) * limit;

  const [projects, totalCount, availablePlatforms] = await Promise.all([
    getProjects({ authorId: session.user.id, limit, offset }),
    getProjectCount({ authorId: session.user.id }),
    getAvailablePlatforms(),
  ]);

  return (
    <Container maxWidth="lg" sx={{ pt: 1, pb: 3, px: { xs: 2, sm: 3 } }}>
      <Breadcrumb
        items={[
          { label: tCommon("projects"), href: "/projects" },
          { label: tProject("manageTitle") },
        ]}
      />

      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
            {tProject("manageTitle")}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexShrink: 0, flexWrap: "wrap" }}>
          <LinkButton
            href="/projects/import"
            variant="outlined"
            sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}
          >
            {tProject("batchImport")}
          </LinkButton>
          <LinkButton
            href="/projects/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ flex: { xs: 1, sm: "none" }, whiteSpace: "nowrap" }}
          >
            {tProject("newProject")}
          </LinkButton>
        </Box>
      </Box>

      <BatchProjectOperationsClient projects={projects} availablePlatforms={availablePlatforms} />
      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 3 }} />
      )}
    </Container>
  );
}
