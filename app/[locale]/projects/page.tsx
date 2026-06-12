import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ProjectCard from "@/components/project/ProjectCard";
import ProjectSearchBar from "@/components/project/ProjectSearchBar";

interface ProjectsPageProps {
  params:      Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string }>;
}

// ダミーデータ（DB接続後に置き換え）
const DUMMY_PROJECTS = [
  {
    id: "1", slug: "example-fabric-mod", name: "ExampleFabricMod",
    description: "Fabricで動作するサンプルMod。新しいブロックとアイテムを追加します。",
    iconUrl: null, type: "mod" as const, license: "MIT", downloads: 12400,
    tags: ["fabric", "1.21", "items", "blocks"],
    authorUsername: "exampledev", authorDisplayName: "Example Dev", authorAvatarUrl: null,
    updatedAt: new Date(),
  },
  {
    id: "2", slug: "example-paper-plugin", name: "ExamplePaperPlugin",
    description: "Paperサーバー向けプラグイン。コマンドと権限管理を拡張します。",
    iconUrl: null, type: "plugin" as const, license: "Apache-2.0", downloads: 8200,
    tags: ["paper", "commands", "permissions"],
    authorUsername: "plugindev", authorDisplayName: "Plugin Dev", authorAvatarUrl: null,
    updatedAt: new Date(),
  },
  {
    id: "3", slug: "forge-utility-mod", name: "ForgeUtilityMod",
    description: "Forgeユーティリティ集。QOL改善のための便利な機能をまとめたMod。",
    iconUrl: null, type: "mod" as const, license: "GPL-3.0", downloads: 5600,
    tags: ["forge", "utility", "qol"],
    authorUsername: "forgedev", authorDisplayName: "Forge Dev", authorAvatarUrl: null,
    updatedAt: new Date(),
  },
  {
    id: "4", slug: "velocity-proxy-plugin", name: "VelocityProxyPlugin",
    description: "Velocityプロキシサーバー向けプラグイン。ロードバランシングを強化。",
    iconUrl: null, type: "plugin" as const, license: "MIT", downloads: 3200,
    tags: ["velocity", "proxy", "network"],
    authorUsername: "networkdev", authorDisplayName: "Network Dev", authorAvatarUrl: null,
    updatedAt: new Date(),
  },
];

export default async function ProjectsPage({ params, searchParams }: ProjectsPageProps) {
  const { locale } = await params;
  const { q, type } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Search");

  // フィルタリング（DB接続後はここをServer Actionに置き換え）
  const filtered = DUMMY_PROJECTS.filter((p) => {
    if (type && type !== "all" && p.type !== type) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      {/* 検索バー */}
      <ProjectSearchBar initialQ={q} initialType={type} />

      {/* 件数表示 */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t("results", { count: filtered.length })}
        </Typography>
      </Box>

      {/* プロジェクト一覧 */}
      {filtered.length > 0 ? (
        <Grid container spacing={2}>
          {filtered.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6" color="text.secondary">
            {t("noResults")}
          </Typography>
        </Box>
      )}
    </Container>
  );
}
