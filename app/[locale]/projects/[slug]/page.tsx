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
import LinkButton from "@/components/ui/LinkButton";
import VersionCard from "@/components/project/VersionCard";
import ReportDialog from "@/components/project/ReportDialog";
import ExtensionIcon from "@mui/icons-material/Extension";
import EditIcon from "@mui/icons-material/Edit";
import GitHubIcon from "@mui/icons-material/GitHub";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import { Link } from "@/i18n/routing";

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

// ダミーデータ（DB接続後に置き換え）
async function getProject(slug: string) {
  const DUMMY: Record<string, object> = {
    "example-fabric-mod": {
      id: "1", slug: "example-fabric-mod", name: "ExampleFabricMod",
      description: "Fabricで動作するサンプルMod。\n\n新しいブロックとアイテムを追加します。\n複数の鉱石や食べ物も実装されています。",
      iconUrl: null, type: "mod", license: "MIT", sourceUrl: "https://github.com/example/example-fabric-mod",
      downloads: 12400, status: "published",
      tags: ["fabric", "1.21", "items", "blocks"],
      author: { username: "exampledev", displayName: "Example Dev", avatarUrl: null },
      versions: [
        {
          id: "v1", versionNumber: "1.2.0",
          mcVersions: ["1.21.5", "1.21.4"],
          loaders: ["fabric"],
          changelog: "バグ修正と新アイテム追加。",
          fileUrl: "https://files.example.com/example-fabric-mod-1.2.0.jar",
          fileName: "example-fabric-mod-1.2.0.jar",
          fileSize: 1024000,
          downloads: 8000,
          createdAt: new Date("2024-11-01"),
        },
        {
          id: "v2", versionNumber: "1.1.0",
          mcVersions: ["1.21"],
          loaders: ["fabric", "quilt"],
          changelog: "初回リリース。",
          fileUrl: "https://files.example.com/example-fabric-mod-1.1.0.jar",
          fileName: "example-fabric-mod-1.1.0.jar",
          fileSize: 920000,
          downloads: 4400,
          createdAt: new Date("2024-09-01"),
        },
      ],
    },
  };
  return DUMMY[slug] ?? null;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [project, session] = await Promise.all([
    getProject(slug),
    auth(),
  ]);

  if (!project) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = project as any;
  const t = await getTranslations("Project");

  // TODO: DB接続後は isOwner = session?.user?.id === p.authorId; に戻す
  const canEdit = !!session?.user;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Grid container spacing={4}>
        {/* ─── 左カラム: プロジェクト情報 ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* ヘッダー */}
          <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", mb: 3 }}>
            <Avatar
              src={p.iconUrl ?? undefined}
              alt={p.name}
              variant="rounded"
              sx={{
                width: 80, height: 80, bgcolor: "primary.dark",
                border: "2px solid", borderColor: "divider",
              }}
            >
              <ExtensionIcon sx={{ fontSize: 40 }} />
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="h4" component="h1" fontWeight={800}>
                  {p.name}
                </Typography>
                <Chip
                  label={p.type === "mod" ? "Mod" : "Plugin"}
                  color={p.type === "mod" ? "primary" : "secondary"}
                  size="small"
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <Avatar src={p.author.avatarUrl ?? undefined} sx={{ width: 22, height: 22 }} />
                <Typography variant="body2" color="text.secondary">
                  {p.author.displayName}
                </Typography>
                <Typography variant="body2" color="text.disabled">·</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <DownloadIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.disabled">
                    {p.downloads.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 編集ボタン（ログイン中のみ） */}
            {canEdit && (
              <LinkButton
                href={`/projects/${p.slug}/edit`}
                id="project-edit-btn"
                variant="contained"
                startIcon={<EditIcon />}
              >
                プロジェクト編集
              </LinkButton>
            )}
          </Box>

          {/* 説明 */}
          <Box
            sx={{
              bgcolor: "background.paper",
              border:  "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 3,
              mb: 3,
              "& pre": { whiteSpace: "pre-wrap", fontFamily: "inherit" },
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {p.description}
            </Typography>
          </Box>

          {/* バージョン一覧 */}
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                {t("versions")}
              </Typography>
              {canEdit && (
                <LinkButton
                  href={`/projects/${p.slug}/versions/new`}
                  id="version-upload-btn"
                  variant="contained"
                  startIcon={<UploadIcon />}
                >
                  新バージョン追加
                </LinkButton>
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
          <Box
            sx={{
              bgcolor:      "background.paper",
              border:       "1px solid",
              borderColor:  "divider",
              borderRadius: 2,
              p:            2.5,
              position:     { md: "sticky" },
              top:          { md: 80 },
            }}
          >
            {/* ライセンス */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: "block" }}>
                ライセンス
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {p.license}
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* ソースコード */}
            {p.sourceUrl && (
              <Box sx={{ mb: 2 }}>
                <Button
                  id="source-code-btn"
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<GitHubIcon />}
                  fullWidth
                  variant="outlined"
                  size="small"
                >
                  ソースコード
                </Button>
              </Box>
            )}

            {/* タグ */}
            {p.tags.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: "block" }}>
                  タグ
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {p.tags.map((tag: string) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: "divider", color: "text.secondary" }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* 通報 */}
            {session?.user && (
              <ReportDialog projectId={p.id} />
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
