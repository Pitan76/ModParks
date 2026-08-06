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

import JsonLd from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";

import { getProjects } from "@/lib/actions/projectQuery";

type TopPageProps = {
  params: Promise<{ locale: string }>;
};

const TopPage = async ({ params }: TopPageProps) => {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tc = await getTranslations("Common");
  const tm = await getTranslations("Metadata");

  const [newResult, updatedResult] = await Promise.all([
    getProjects({ sort: "newest", limit: 6 }),
    getProjects({ sort: "updated", limit: 6 }),
  ]);

  const newProjects = newResult;
  const updatedProjects = updatedResult;

  return (
    <Box>
      {/* 検索結果にドメイン名ではなくサイト名を出すためのシグナル。トップページのみ */}
      <JsonLd data={[websiteSchema(tm("description")), organizationSchema()]} />

      {/* SEO用に見出しを明示（ビジュアル上は非表示にするが、クローラーには認識させる） */}
      <h1
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          border: 0,
        }}
      >
        {t("hero.title")}
      </h1>

      {/* Hero */}
      <HomeHero
        labels={{
          title: t("hero.title"),
          titleHighlight: t("hero.titleHighlight"),
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
            href="/projects?sort=newest"
            id="view-all-btn"
            aria-label={`${t("newProjects")} - ${t("viewAll")}`}
            endIcon={<ArrowForwardIcon />}
            sx={{ color: "primary.main" }}
          >
            {t("viewAll")}
          </LinkButton>
        </Box>

        <HomeProjectList projects={newProjects} />
      </Container>

      {/* 広告差し込み予約 */}
      <Container maxWidth="lg" sx={{ pb: 4, display: { xs: "none", sm: "block" } }}>
        <AdSlot slot="home-mid" format="horizontal" maxHeight={100} />
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
            aria-label={`${t("updatedProjects")} - ${t("viewAll")}`}
            endIcon={<ArrowForwardIcon />}
            sx={{ color: "primary.main" }}
          >
            {t("viewAll")}
          </LinkButton>
        </Box>

        <HomeProjectList projects={updatedProjects} />
      </Container>
    </Box>
  );
};

export default TopPage;
