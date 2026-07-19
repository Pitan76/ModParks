"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { getLoaderInfo } from "@/lib/loaders";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import { useContextMenu, useCommonItems } from "@/components/ui/ContextMenu";
import { useLocale, useTranslations } from "next-intl";

/**
 * バージョン一覧の各カードに表示するデータの型定義
 */
interface VersionCardProps {
  version: {
    id:            string;
    versionNumber: string;
    releaseChannel: string;
    mcVersions:    string | string[];
    loaders:       string | string[];
    changelog:     string;
    fileUrl:       string;
    fileName:      string;
    fileSize:      number | null;
    downloads:     number;
    createdAt:     Date | number;
  };
  projectSlug: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


/**
 * プロジェクトの特定バージョンをカード形式で表示するコンポーネント
 * ダウンロードボタン、対応MCバージョン、ローダー等を整理して表示します。
 */
export default function VersionCard({ version, projectSlug }: VersionCardProps) {
  const locale = useLocale();
  const t = useTranslations("Project");
  const tMenu = useTranslations("ContextMenu");

  const c = useCommonItems();
  const downloadUrl = `/api/download?versionId=${version.id}`;
  const onContextMenu = useContextMenu([
    c.open(`/projects/${projectSlug}`, tMenu("viewProject")),
    { type: "divider" },
    {
      id: "cm-version-download",
      label: tMenu("download"),
      icon: <DownloadIcon fontSize="small" />,
      onClick: () => { window.location.href = downloadUrl; },
    },
    c.copyLink(downloadUrl),
    c.copyText(version.versionNumber, `v${version.versionNumber}`),
  ]);

  const date = new Date(
    typeof version.createdAt === "number"
      ? version.createdAt * 1000
      : version.createdAt
  );

  const parsedLoaders = Array.isArray(version.loaders)
    ? version.loaders
    : (JSON.parse(version.loaders || "[]") as string[]);

  const parsedMcVersions = Array.isArray(version.mcVersions)
    ? version.mcVersions
    : (JSON.parse(version.mcVersions || "[]") as string[]);

  return (
    <Card
      id={`version-card-${version.id}`}
      onContextMenu={onContextMenu}
      sx={{ mb: 1.5, "&:hover": { borderColor: "primary.main" } }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          {/* 左: バージョン情報 */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700,  color: "primary.main"  }}>
                v{version.versionNumber}
              </Typography>
              <ReleaseChannelChip channel={version.releaseChannel} />


              {/* ローダー */}
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                {parsedLoaders.map((l) => {
                  const info = getLoaderInfo(l);
                  return (
                    <Chip
                      key={l}
                      label={info.name}
                      size="small"
                      color={info.color as any}
                      icon={info.icon}
                      sx={{ borderRadius: "4px" }}
                    />
                  );
                })}
              </Stack>

              {/* MC バージョン */}
              {parsedMcVersions.slice(0, 3).map((mc) => (
                <Chip
                  key={mc}
                  label={mc}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem", borderColor: "divider", color: "text.secondary" }}
                />
              ))}
              {parsedMcVersions.length > 3 && (
                <Typography variant="caption" color="text.disabled">
                  +{parsedMcVersions.length - 3}
                </Typography>
              )}
            </Box>

            {/* 更新内容 */}
            {version.changelog && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display:         "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow:        "hidden",
                }}
              >
                {version.changelog}
              </Typography>
            )}

            {/* メタ情報 */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled" suppressHydrationWarning>
                  {date.toLocaleDateString(locale)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <DownloadIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled">
                  {version.downloads.toLocaleString()}
                </Typography>
              </Box>
              {version.fileSize && (
                <Typography variant="caption" color="text.disabled">
                  {formatBytes(version.fileSize)}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* 右: DLボタン */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button
              id={`download-btn-${version.id}`}
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              href={`/api/download?versionId=${version.id}`}
              sx={{ whiteSpace: "nowrap" }}
            >
              {t("download")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
