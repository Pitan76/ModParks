import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import ProjectCard from "@/components/project/ProjectCard";

// ダミーデータ（後でDB接続に置き換え）
const DUMMY_PROJECTS = [
  {
    id: "1",
    slug: "example-fabric-mod",
    name: "ExampleFabricMod",
    description: "Fabricで動作するサンプルMod。新しいブロックとアイテムを追加します。",
    iconUrl: null,
    type: "mod" as const,
    license: "MIT",
    downloads: 12400,
    tags: ["fabric", "1.21", "items", "blocks"],
    authorUsername: "exampledev",
    authorDisplayName: "Example Dev",
    authorAvatarUrl: null,
    updatedAt: new Date(),
  },
  {
    id: "2",
    slug: "example-paper-plugin",
    name: "ExamplePaperPlugin",
    description: "Paperサーバー向けプラグイン。コマンドと権限管理を拡張します。",
    iconUrl: null,
    type: "plugin" as const,
    license: "Apache-2.0",
    downloads: 8200,
    tags: ["paper", "commands", "permissions"],
    authorUsername: "plugindev",
    authorDisplayName: "Plugin Dev",
    authorAvatarUrl: null,
    updatedAt: new Date(),
  },
  {
    id: "3",
    slug: "forge-utility-mod",
    name: "ForgeUtilityMod",
    description: "Forgeユーティリティ集。QOL改善のための便利な機能をまとめたMod。",
    iconUrl: null,
    type: "mod" as const,
    license: "GPL-3.0",
    downloads: 5600,
    tags: ["forge", "utility", "qol"],
    authorUsername: "forgedev",
    authorDisplayName: "Forge Dev",
    authorAvatarUrl: null,
    updatedAt: new Date(),
  },
];

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tc = await getTranslations("Common");

  return (
    <Box>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          position:   "relative",
          py:         { xs: 8, md: 14 },
          overflow:   "hidden",
          // background: "linear-gradient(180deg, rgba(74,222,128,0.08) 0%, transparent 100%)",
          "&::before": {
            content:  '""',
            position: "absolute",
            inset:    0,
            // background:
            //   "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(74,222,128,0.15) 0%, transparent 70%)",
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
              sx={{ mb: 5, fontWeight: 400, lineHeight: 1.6 }}
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
                {tc("search")} Mod / Plugin
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
                投稿する
              </LinkButton>
            </Box>

            {/* バッジ */}
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 4, flexWrap: "wrap" }}>
              {["Fabric", "Forge", "NeoForge", "Paper", "Spigot", "Quilt"].map((l) => (
                <Chip
                  key={l}
                  label={l}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: "divider", color: "text.secondary" }}
                />
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ─── 新着プロジェクト ──────────────────────────────────────────── */}
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
          {DUMMY_PROJECTS.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
