"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { getLoaderInfo } from "@/lib/loaders";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import { useContextMenuHandler, useCommonItems } from "@/components/ui/ContextMenu";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";
import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { compactMcVersions } from "@/lib/utils/format";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import { Link } from "@/i18n/routing";

interface ProjectVersionsTableProps {
  versions: {
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
  }[];
  projectSlug: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

import { normalizeReleaseChannel } from "@/lib/releaseChannels";

export default function ProjectVersionsTable({ versions, projectSlug }: ProjectVersionsTableProps) {
  const locale = useLocale();
  const t = useTranslations("Project");
  const tVersion = useTranslations("Version");
  const tMenu = useTranslations("ContextMenu");
  const [filterChannel, setFilterChannel] = useState<string>("all");

  const openMenu = useContextMenuHandler();
  const c = useCommonItems();
  const versionMenu = (versionId: string, versionNumber: string): ContextMenuItem[] => {
    const versionUrl = `/projects/${projectSlug}/versions/${versionId}`;
    const downloadUrl = `/api/download?versionId=${versionId}`;
    return [
      c.open(versionUrl, tMenu("open")),
      c.openNewTab(versionUrl),
      { type: "divider" },
      {
        id: "cm-version-download",
        label: tMenu("download"),
        onClick: () => { window.location.href = downloadUrl; },
      },
      c.copyLink(versionUrl),
      c.copyText(versionNumber, `v${versionNumber}`),
    ];
  };

  const parsedVersions = useMemo(() => {
    return versions.map((version) => {
      const rawMcVersions = Array.isArray(version.mcVersions) ? version.mcVersions : (JSON.parse(version.mcVersions || "[]") as string[]);
      return {
        ...version,
        releaseChannel: normalizeReleaseChannel(version.releaseChannel),
        date: new Date(typeof version.createdAt === "number" ? version.createdAt * 1000 : version.createdAt),
        parsedLoaders: Array.isArray(version.loaders) ? version.loaders : (JSON.parse(version.loaders || "[]") as string[]),
        parsedMcVersions: compactMcVersions(rawMcVersions),
      };
    });
  }, [versions]);

  const filteredVersions = useMemo(() => {
    if (filterChannel === "all") return parsedVersions;
    return parsedVersions.filter((v) => v.releaseChannel === filterChannel);
  }, [parsedVersions, filterChannel]);

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={filterChannel} onChange={(e, val) => setFilterChannel(val)} aria-label="Version channels">
          <Tab label="All" value="all" />
          <Tab label={tVersion("channels.release")} value="release" />
          <Tab label={tVersion("channels.beta")} value="beta" />
          <Tab label={tVersion("channels.alpha")} value="alpha" />
        </Tabs>
      </Box>


      {/* Desktop Table View */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, display: { xs: "none", md: "block" }, width: "100%", maxWidth: "100%", overflowX: "auto" }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t("table.version")}</TableCell>
              <TableCell>{t("table.platformMcVersion")}</TableCell>
              <TableCell>{t("table.sizeDownloadDate")}</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVersions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No versions found in this channel.
                </TableCell>
              </TableRow>
            ) : filteredVersions.map((version) => {
              const versionUrl = `/projects/${projectSlug}/versions/${version.id}`;
              return (
                <TableRow
                  key={version.id}
                  hover
                  onContextMenu={(e) => openMenu(e, versionMenu(version.id, version.versionNumber))}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Link href={versionUrl} style={{ textDecoration: "none" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main", "&:hover": { textDecoration: "underline" } }}>
                          v{version.versionNumber}
                        </Typography>
                      </Link>
                      <ReleaseChannelChip channel={version.releaseChannel} />
                    </Stack>
                    {version.changelog && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          mt: 0.5,
                          maxWidth: 250
                        }}
                      >
                        {version.changelog}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                      {version.parsedLoaders.map((l) => {
                        const info = getLoaderInfo(l);
                        return (
                          <Chip
                            key={l}
                            label={info.name}
                            size="small"
                            color={info.color as any}
                            icon={info.icon}
                          />
                        );
                      })}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {version.parsedMcVersions.map((mc) => (
                        <Chip
                          key={mc}
                          label={mc}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: "divider", color: "text.secondary" }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <CalendarTodayIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="caption" color="text.disabled" suppressHydrationWarning>
                          {version.date.toLocaleDateString(locale)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <DownloadIcon sx={{ fontSize: 14, color: "text.disabled" }} />
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
                  </TableCell>
                  <TableCell align="right">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile Card View */}
      <Stack spacing={2} sx={{ display: { xs: "flex", md: "none" } }}>
        {filteredVersions.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
            No versions found in this channel.
          </Box>
        ) : filteredVersions.map((version) => {
          const versionUrl = `/projects/${projectSlug}/versions/${version.id}`;
          return (
            <Card
              key={version.id}
              variant="outlined"
              onContextMenu={(e) => openMenu(e, versionMenu(version.id, version.versionNumber))}
            >
              <CardContent sx={{ pb: 1 }}>
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
                
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  <Typography variant="caption" color="text.disabled" suppressHydrationWarning>
                    {version.date.toLocaleDateString(locale)}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                <Button
                  id={`mobile-download-btn-${version.id}`}
                  variant="contained"
                  fullWidth
                  startIcon={<DownloadIcon />}
                  href={`/api/download?versionId=${version.id}`}
                >
                  {t("download")}
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Stack>
    </>
  );
}
