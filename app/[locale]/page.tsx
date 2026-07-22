import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import HomeProjectList from "@/components/project/HomeProjectList";
import HomeHero from "@/components/layout/HomeHero";
import AdSlot from "@/components/ads/AdSlot";

import { getProjects } from "@/lib/actions/projectQuery";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

const HomePage = async ({ params }: HomePageProps) => {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tc = await getTranslations("Common");

  const [{ data: newProjects }, { data: updatedProjects }] = await Promise.all([
    getProjects({ sort: "newest", limit: 6 }),
    getProjects({ sort: "updated", limit: 6 }),
  ]);

  return (
    <Box>
      {/* Hero */}
      <HomeHero
        labels={{
          title: t("hero.title"),
          description: t("hero.description"),
          search: tc("search"),
          cta: t("cta"),
        }}
      />

      {/* 新着プロジェクト */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("newProjects")}
          </Typography>
          <LinkButton
            href="/projects"
            id="view-all-btn"
            endIcon={<ArrowForwardIcon />}
            sx={{ color: "primary.main" }}
          >
            {t("viewAll")}
          </LinkButton>
        </Box>

        <HomeProjectList projects={newProjects as any} />
      </Container>

      <Container maxWidth="lg" sx={{ pb: 4 }}>
        <AdSlot slot="home-mid" />
      </Container>

      {/* 最近更新されたプロジェクト */}
      <Container maxWidth="lg" sx={{ pb: 6 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("updatedProjects")}
          </Typography>
          <LinkButton
            href="/projects?sort=updated"
            id="view-updated-btn"
            endIcon={<ArrowForwardIcon />}
            sx={{ color: "primary.main" }}
          >
            {t("viewAll")}
          </LinkButton>
        </Box>

        <HomeProjectList projects={updatedProjects as any} />
      </Container>
    </Box>
  );
};

export default HomePage;
