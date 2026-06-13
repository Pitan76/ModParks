import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import UploadIcon from "@mui/icons-material/Upload";
import { Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import { getProjectBySlug } from "@/lib/actions/project";
import ProjectDetailHeader from "@/components/project/ProjectDetailHeader";
import ProjectSidebar from "@/components/project/ProjectSidebar";
import VersionCard from "@/components/project/VersionCard";

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [project, session] = await Promise.all([
    getProjectBySlug(slug),
    auth(),
  ]);

  if (!project) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = project as any;
  const t = await getTranslations("Project");

  const isOwner = session?.user?.id === p.authorId;
  const canEdit = isOwner;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Grid container spacing={4}>
        {/* ─── 左カラム: プロジェクト情報 ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          
          <ProjectDetailHeader project={p} canEdit={canEdit} />

          {/* バージョン一覧 */}
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("versions")}
              </Typography>
              {canEdit && (
                <Button variant="contained" size="small" component={Link} href={`/projects/${p.slug}/versions/new`}>
                  {t("header.addVersion")}
                </Button>
              )}
            </Box>

            {p.versions.length > 0 ? (
              p.versions.map((v: any) => (
                <VersionCard key={v.id} version={v} projectSlug={slug} />
              ))
            ) : (
              <Typography color="text.secondary">{t("noVersions")}</Typography>
            )}
          </Box>
        </Grid>

        {/* ─── 右カラム: サイドバー ─────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <ProjectSidebar project={p} isAuthenticated={!!session?.user} />
        </Grid>
      </Grid>
    </Container>
  );
}
