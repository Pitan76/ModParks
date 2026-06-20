import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { auth } from "@/lib/auth";
import { getProjects } from "@/lib/actions/project";
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

  // Fetch all user projects (no pagination limit, or high limit) for management
  // For management, we usually want to fetch all or a very high limit.
  const { data: projects } = await getProjects({ 
    authorId: session.user.id, 
    limit: 1000 
  });

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Box sx={{ mb: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }} gutterBottom>
            プロジェクト管理
          </Typography>
          <Typography variant="body1" color="text.secondary">
            あなたのすべてのプロジェクトを管理し、ステータス変更や一括削除などの操作を行えます。
          </Typography>
        </Box>
        
        <Box sx={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <LinkButton
            href="/projects/import"
            variant="outlined"
            sx={{ flexShrink: 0 }}
          >
            一括インポート
          </LinkButton>
          <LinkButton
            href="/projects/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ flexShrink: 0 }}
          >
            {tProject("newProject")}
          </LinkButton>
        </Box>
      </Box>

      <BatchProjectOperationsClient projects={projects as any[]} />
    </Container>
  );
}
