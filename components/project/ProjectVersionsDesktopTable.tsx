"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
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
import { Link } from "@/i18n/routing";
import type { MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildVersionDownloadUrl } from "@/lib/utils/downloadUrl";
import { getLoaderInfo } from "@/lib/loaders";
import { formatBytes } from "@/lib/utils/format";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import SortableTableCell from "@/components/ui/SortableTableCell";
import { tableContainerSx, tableHeadSx, tableRootSx } from "@/components/ui/tableStyles";
import { useContextMenuHandler } from "@/components/ui/ContextMenu";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";
import type { SortOrder } from "@/lib/hooks/useTableSort";
import type { ParsedProjectVersion } from "./useProjectVersions";

type Props = {
  versions:    ParsedProjectVersion[];
  projectSlug: string;
  order:       SortOrder;
  orderBy:     string | null;
  onSort:      (key: "version" | "downloads" | "date") => void;
  buildMenu:   (versionId: string, versionNumber: string) => ContextMenuItem[];
};

/**
 * 公開バージョン一覧のデスクトップ向けテーブル。ヘッダクリックで並び替え可能。
 */
export default function ProjectVersionsDesktopTable({ versions, projectSlug, order, orderBy, onSort, buildMenu }: Props) {
  const locale = useLocale();
  const t = useTranslations("Project");
  const openMenu = useContextMenuHandler();

  return (
    <TableContainer component={Paper} sx={[tableContainerSx, { mb: 2, display: { xs: "none", md: "block" } }]}>
      <Table sx={[tableRootSx, { minWidth: 650 }]}>
        <TableHead sx={tableHeadSx}>
          <TableRow>
            <SortableTableCell columnKey="version" activeKey={orderBy} order={order} onSort={onSort}>
              {t("table.version")}
            </SortableTableCell>
            <TableCell>{t("table.platformMcVersion")}</TableCell>
            <SortableTableCell columnKey="downloads" activeKey={orderBy} order={order} onSort={onSort}>
              {t("table.sizeDownloadDate")}
            </SortableTableCell>
            <SortableTableCell columnKey="date" activeKey={orderBy} order={order} onSort={onSort}>
              {t("createdAt")}
            </SortableTableCell>
            <TableCell align="right"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {versions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                {t("table.noVersionsInChannel")}
              </TableCell>
            </TableRow>
          ) : versions.map((version) => {
            const versionUrl = `/projects/${projectSlug}/versions/${version.id}`;
            return (
              <TableRow
                key={version.id}
                hover
                onContextMenu={(e: MouseEvent<HTMLTableRowElement>) => openMenu(e, buildMenu(version.id, version.versionNumber))}
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
                      sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mt: 0.5, maxWidth: 250 }}
                    >
                      {version.changelog}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                    {version.parsedLoaders.map((l) => {
                      const info = getLoaderInfo(l);
                      return <Chip key={l} label={info.name} size="small" color={info.color as any} icon={info.icon} />;
                    })}
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {version.parsedMcVersions.map((mc) => (
                      <Chip key={mc} label={mc} size="small" variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }} />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1.5}>
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
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                    <Typography variant="caption" color="text.disabled" suppressHydrationWarning>
                      {version.date.toLocaleDateString(locale)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t("download")}>
                    <IconButton
                      id={`download-btn-${version.id}`}
                      color="primary"
                      size="small"
                      aria-label={t("download")}
                      href={buildVersionDownloadUrl(version.id)}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
