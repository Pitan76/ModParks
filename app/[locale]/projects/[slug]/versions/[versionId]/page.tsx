import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getProjectBySlug } from "@/lib/actions/project";
import { getVersionById } from "@/lib/actions/version";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "@/i18n/routing";
import { getLoaderInfo } from "@/lib/loaders";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { SITE_URL } from "@/lib/config";

interface VersionDetailPageProps {
  params: Promise<{ locale: string; slug: string; versionId: string }>;
}

export async function generateMetadata({ params }: VersionDetailPageProps) {
  const { slug, versionId } = await params;
  const project = await getProjectBySlug(slug);
  const version = await getVersionById(versionId);

  if (!project || !version) {
    return { title: "Not Found" };
  }

  const title = `${project.name} v${version.versionNumber}`;
  const description = version.changelog || `Download ${project.name} version ${version.versionNumber}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: SITE_URL + `/projects/${project.slug}/versions/${version.id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function VersionDetailPage({ params }: VersionDetailPageProps) {
  const { locale, slug, versionId } = await params;
  setRequestLocale(locale);

  const [project, version, session] = await Promise.all([
    getProjectBySlug(slug),
    getVersionById(versionId),
    auth(),
  ]);

  if (!project || !version) notFound();

  // If the project is not public, check auth
  if (project.status !== "public") {
    if (!session?.user) notFound();
    const isOwner = session.user.id === project.authorId;
    // For simplicity here, we rely on the owner check. In a more complex app, we should also check if the user is a member/admin.
    if (!isOwner && session.user.role !== "admin") {
      notFound();
    }
  }

  const t = await getTranslations("Project");

  const parsedLoaders = Array.isArray(version.loaders) ? version.loaders : (JSON.parse(version.loaders || "[]") as string[]);
  const parsedMcVersions = Array.isArray(version.mcVersions) ? version.mcVersions : (JSON.parse(version.mcVersions || "[]") as string[]);
  const dateStr = new Date(typeof version.createdAt === "number" ? version.createdAt * 1000 : version.createdAt).toLocaleDateString(locale);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link href={`/projects`} style={{ textDecoration: "none", color: "inherit" }}>
          {t("title")}
        </Link>
        <Link href={`/projects/${project.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
          {project.name}
        </Link>
        <Link href={`/projects/${project.slug}?tab=files`} style={{ textDecoration: "none", color: "inherit" }}>
          {t("versions")}
        </Link>
        <Typography color="text.primary">v{version.versionNumber}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <Button
          component={Link}
          href={`/projects/${project.slug}?tab=files`}
          startIcon={<ArrowBackIcon />}
          sx={{ mr: 2, color: "text.secondary" }}
        >
          {t("back")}
        </Button>
      </Box>

      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 3, gap: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
                v{version.versionNumber}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ color: "text.secondary", alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2" suppressHydrationWarning>{dateStr}</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <DownloadIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2">{version.downloads.toLocaleString()} downloads</Typography>
                </Box>
                {version.fileSize && (
                  <Typography variant="body2">{formatBytes(version.fileSize)}</Typography>
                )}
              </Stack>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              href={`/api/download?versionId=${version.id}`}
              sx={{ py: 1.5, px: 4, borderRadius: 2, fontWeight: 700, width: { xs: "100%", sm: "auto" } }}
            >
              {t("download")}
            </Button>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary", fontWeight: 600 }}>{t("table.platformMcVersion")}</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              {parsedLoaders.map((l) => {
                const info = getLoaderInfo(l);
                return <Chip key={l} label={info.name} color={info.color as any} icon={info.icon} />;
              })}
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {parsedMcVersions.map((mc) => (
                <Chip key={mc} label={mc} variant="outlined" sx={{ borderColor: "divider" }} />
              ))}
            </Box>
          </Box>

          {version.changelog ? (
            <Box sx={{ mt: 4, pt: 4, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Changelog</Typography>
              <MarkdownRenderer content={version.changelog} />
            </Box>
          ) : (
            <Box sx={{ mt: 4, pt: 4, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography color="text.secondary">No changelog provided.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
