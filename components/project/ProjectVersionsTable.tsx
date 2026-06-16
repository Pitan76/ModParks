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
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

interface ProjectVersionsTableProps {
  versions: {
    id:            string;
    versionNumber: string;
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

export default function ProjectVersionsTable({ versions, projectSlug }: ProjectVersionsTableProps) {
  const locale = useLocale();
  const t = useTranslations("Project");

  const parsedVersions = useMemo(() => {
    return versions.map((version) => ({
      ...version,
      date: new Date(typeof version.createdAt === "number" ? version.createdAt * 1000 : version.createdAt),
      parsedLoaders: Array.isArray(version.loaders) ? version.loaders : (JSON.parse(version.loaders || "[]") as string[]),
      parsedMcVersions: Array.isArray(version.mcVersions) ? version.mcVersions : (JSON.parse(version.mcVersions || "[]") as string[]),
    }));
  }, [versions]);

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
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
          {parsedVersions.map((version) => {
            return (
              <TableRow key={version.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                    v{version.versionNumber}
                  </Typography>
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
  );
}
