"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import DownloadIcon from "@mui/icons-material/Download";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { Link } from "@/lib/i18n/routing";
import type { MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildVersionDownloadUrl } from "@/lib/utils/downloadUrl";
import { getLoaderInfo } from "@/lib/loaders";
import { formatBytes } from "@/lib/utils/format";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import { useContextMenuHandler } from "@/components/ui/ContextMenu";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";
import type { ParsedProjectVersion } from "./useProjectVersions";

type Props = {
  versions:    ParsedProjectVersion[];
  projectSlug: string;
  buildMenu:   (versionId: string, versionNumber: string) => ContextMenuItem[];
};

/**
 * 公開バージョン一覧のモバイル向けカードリスト。
 */
export default function ProjectVersionsMobileList({ versions, projectSlug, buildMenu }: Props) {
  const locale = useLocale();
  const t = useTranslations("Project");
  const openMenu = useContextMenuHandler();

  return (
    <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
      {versions.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
          {t("table.noVersionsInChannel")}
        </Box>
      ) : versions.map((version) => {
        const versionUrl = `/projects/${projectSlug}/versions/${version.id}`;
        return (
          <Card
            key={version.id}
            variant="outlined"
            onContextMenu={(e: MouseEvent<HTMLDivElement>) => openMenu(e, buildMenu(version.id, version.versionNumber))}
          >
            <CardContent sx={{ p: 2, pb: 1, "&:last-child": { pb: 1 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Link href={versionUrl} style={{ textDecoration: "none" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "primary.main", "&:hover": { textDecoration: "underline" } }}>
                      v{version.versionNumber}
                    </Typography>
                  </Link>
                  <ReleaseChannelChip channel={version.releaseChannel} />
                </Stack>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {version.fileSize && (
                    <Typography variant="caption" color="text.disabled">
                      {formatBytes(version.fileSize)}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <DownloadIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                    <Typography variant="caption" color="text.disabled">
                      {version.downloads.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
                {version.parsedLoaders.map((l) => {
                  const info = getLoaderInfo(l);
                  return <Chip key={l} label={info.name} size="small" color={info.color as any} icon={info.icon} />;
                })}
                {version.parsedMcVersions.map((mc) => (
                  <Chip key={mc} label={mc} size="small" variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }} />
                ))}
              </Box>

              {version.changelog && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mt: 1 }}
                >
                  {version.changelog}
                </Typography>
              )}

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
                <CalendarTodayIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled" suppressHydrationWarning>
                  {version.date.toLocaleDateString(locale)}
                </Typography>
              </Box>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
              <Button
                id={`mobile-download-btn-${version.id}`}
                variant="contained"
                fullWidth
                startIcon={<DownloadIcon />}
                href={buildVersionDownloadUrl(version.id)}
              >
                {t("download")}
              </Button>
            </CardActions>
          </Card>
        );
      })}
    </Stack>
  );
}
