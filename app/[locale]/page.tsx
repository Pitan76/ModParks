import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import ProjectCard from "@/components/project/ProjectCard";
import { getLoaderInfo } from "@/lib/loaders";
import AdSlot from "@/components/ads/AdSlot";

import { getProjects } from "@/lib/actions/project";

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
      <Box
        sx={{
          position:   "relative",
          py:         { xs: 8, md: 14 },
          overflow:   "hidden",
          "&::before": {
            content:  '""',
            position: "absolute",
            inset:    0,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto" }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight:   900,
                mb:           2,
                lineHeight:   1.15,
                fontSize:     { xs: "2rem", md: "3rem" },
              }}
            >
              {t("hero.title")}{" "}
              <Box
                component="span"
                sx={{
                  background:         "linear-gradient(135deg, #4ade80, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {t("hero.titleHighlight")}
              </Box>
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400, lineHeight: 1.6, px: { xs: 2, sm: 4 } }}
            >
              {t("hero.description")}
            </Typography>

            {/* 検索ボタン → /projects へ */}
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
              <LinkButton
                href="/projects"
                id="hero-search-btn"
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
              >
                {tc("search")}
              </LinkButton>
              <LinkButton
                href="/projects/new"
                id="hero-cta-btn"
                variant="outlined"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  px: 4, py: 1.5, fontSize: "1rem",
                  borderColor: "primary.main",
                  color:        "primary.main",
                }}
              >
                {t("cta")}
              </LinkButton>
            </Box>

            {/* バッジ */}
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 4, flexWrap: "wrap" }}>
              {["Fabric", "Forge", "NeoForge", "Paper", "Spigot", "Quilt"].map((l) => {
                const info = getLoaderInfo(l.toLowerCase());
                return (
                  <Chip
                    key={l}
                    label={info.name}
                    variant="outlined"
                    size="small"
                    icon={info.icon}
                    sx={{ borderColor: "divider", color: "text.secondary" }}
                  />
                );
              })}
            </Box>
          </Box>
        </Container>
      </Box>

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

        <Grid container spacing={2}>
          {newProjects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={project} layout="grid" />
            </Grid>
          ))}
        </Grid>
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

        <Grid container spacing={2}>
          {updatedProjects.map((project) => (
            <Grid key={`updated-${project.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={project} layout="grid" />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default HomePage;
