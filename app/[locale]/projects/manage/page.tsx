import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumb from "@/components/ui/Breadcrumb";
import AddIcon from "@mui/icons-material/Add";
import { auth } from "@/lib/auth";
import { getProjects } from "@/lib/actions/projectQuery";
import LinkButton from "@/components/ui/LinkButton";
import BatchProjectOperationsClient from "@/components/project/BatchProjectOperationsClient";

interface ManageProjectsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ManageProjectsPage({ params }: ManageProjectsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const tProject = await getTranslations("Project");
  const tCommon = await getTranslations("Common");

  // Fetch all user projects (no pagination limit, or high limit) for management
  // For management, we usually want to fetch all or a very high limit.
  const { data: projects } = await getProjects({ 
    authorId: session.user.id, 
    limit: 1000 
  });

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Breadcrumb
        items={[
          { label: tCommon("projects"), href: "/projects" },
          { label: tProject("manageTitle") },
        ]}
      />

      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }} gutterBottom>
            {tProject("manageTitle")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {tProject("manageDescription")}
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

      <BatchProjectOperationsClient projects={projects as any[]} />
    </Container>
  );
}
