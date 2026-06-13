import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ProjectCard from "@/components/project/ProjectCard";
import ProjectSearchBar from "@/components/project/ProjectSearchBar";
import { getProjects } from "@/lib/actions/project";
import { auth } from "@/lib/auth";

interface ProjectsPageProps {
  params:      Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string; author?: string }>;
}

export default async function ProjectsPage({ params, searchParams }: ProjectsPageProps) {
  const { locale } = await params;
  const { q, type, author } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Search");
  const session = await auth();

  // /projects?author=me の場合は自分のプロジェクトのみ（下書き含む）を取得
  const authorId = author === "me" && session?.user?.id ? session.user.id : undefined;

  // フィルタリング
  const filtered = await getProjects({
    q,
    type: type as "mod" | "plugin",
    authorId,
  });

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      {/* ページタイトル */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h4" component="h1" fontWeight={800} gutterBottom>
          {author === "me" ? "マイプロジェクト" : "プロジェクトを探す"}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {author === "me" 
            ? "あなたが作成したModやプラグインの一覧です。（下書きも表示されます）" 
            : "世界中の開発者が作成した素晴らしいModやプラグインを見つけましょう。"}
        </Typography>
      </Box>

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
