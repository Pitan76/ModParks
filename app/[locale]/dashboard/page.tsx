import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import LinkButton from "@/components/ui/LinkButton";
import { getDashboardData } from "./dashboardData";
import StatsGrid from "./StatsGrid";
import DashboardMain from "./DashboardMain";
import DashboardSidebar from "./DashboardSidebar";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const data = await getDashboardData(session.user.id);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mb: 4,
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>
          {t("title")}
        </Typography>
        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexWrap: "wrap" }}>
          <LinkButton
            href="/ideas/new"
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            sx={{ flex: { xs: 1, sm: "none" }, borderRadius: 2, px: { xs: 2, sm: 3 }, fontWeight: "bold", textTransform: "none", whiteSpace: "nowrap" }}
          >
            {t("newIdea")}
          </LinkButton>
          <LinkButton
            href="/projects/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            sx={{ flex: { xs: 1, sm: "none" }, borderRadius: 2, px: { xs: 2, sm: 3 }, fontWeight: "bold", textTransform: "none", whiteSpace: "nowrap" }}
          >
            {tNav("newProject")}
          </LinkButton>
        </Box>
      </Box>

      <StatsGrid
        totalProjects={data.stats.totalProjects}
        totalDownloads={data.stats.totalDownloads}
        favorites={data.favorites.length}
        comments={data.totalComments}
      />

      <Grid container spacing={{ xs: 3, md: 4 }}>
        <DashboardMain locale={locale} recentProjects={data.recentProjects} myIdeas={data.myIdeas} />
        <DashboardSidebar locale={locale} latestComments={data.latestComments} topFavorites={data.topFavorites} />
      </Grid>
    </Container>
  );
}
