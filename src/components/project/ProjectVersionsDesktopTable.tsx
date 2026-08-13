"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { Link } from "@/lib/i18n/routing";
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

/** 行の高さを揃えるためのセル余白。既定値は 1 行の情報量に対して広すぎる */
const cellSx = { py: 1 } as const;

/** 数値・日付は折り返すと桁が縦に割れて読めなくなる */
const compactCellSx = { ...cellSx, whiteSpace: "nowrap" } as const;

/**
 * 公開バージョン一覧のデスクトップ向けテーブル。ヘッダクリックで並び替え可能。
 */
export default function ProjectVersionsDesktopTable({ versions, projectSlug, order, orderBy, onSort, buildMenu }: Props) {
  const locale = useLocale();
  const t = useTranslations("Project");
  const openMenu = useContextMenuHandler();

  return (
    <TableContainer component={Paper} sx={[tableContainerSx, { display: { xs: "none", md: "block" } }]}>
      <Table size="small" sx={[tableRootSx, { minWidth: 720 }]}>
        <TableHead sx={tableHeadSx}>
          <TableRow>
            <SortableTableCell columnKey="version" activeKey={orderBy} order={order} onSort={onSort}>
              {t("table.version")}
            </SortableTableCell>
            <TableCell>{t("table.platformMcVersion")}</TableCell>
            <SortableTableCell columnKey="downloads" activeKey={orderBy} order={order} onSort={onSort} align="right">
              {t("table.downloads")}
            </SortableTableCell>
            <TableCell align="right">{t("table.size")}</TableCell>
            <SortableTableCell columnKey="date" activeKey={orderBy} order={order} onSort={onSort}>
              {t("createdAt")}
            </SortableTableCell>
            <TableCell align="right" sx={{ width: 56 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {versions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
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
                <TableCell sx={cellSx}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Link href={versionUrl} style={{ textDecoration: "none" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
                        v{version.versionNumber}
                      </Typography>
                    </Link>
                    <ReleaseChannelChip channel={version.releaseChannel} />
                  </Stack>
                  {version.changelog && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      title={version.changelog}
                      sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}
                    >
                      {version.changelog}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={cellSx}>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                    {version.parsedLoaders.map((l) => {
                      const info = getLoaderInfo(l);
                      return <Chip key={l} label={info.name} size="small" color={info.color as any} icon={info.icon} sx={{ height: 22 }} />;
                    })}
                    {version.parsedMcVersions.map((mc) => (
                      <Chip key={mc} label={mc} size="small" variant="outlined" sx={{ height: 22, borderColor: "divider", color: "text.secondary" }} />
                    ))}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={compactCellSx}>
                  <Typography variant="body2" color="text.secondary">
                    {version.downloads.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={compactCellSx}>
                  <Typography variant="body2" color="text.secondary">
                    {version.fileSize ? formatBytes(version.fileSize) : "-"}
                  </Typography>
                </TableCell>
                <TableCell sx={compactCellSx}>
                  <Typography variant="body2" color="text.secondary" suppressHydrationWarning>
                    {version.date.toLocaleDateString(locale)}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={cellSx}>
                  <Tooltip title={t("download")}>
                    <IconButton
                      id={`download-btn-${version.id}`}
                      color="primary"
                      size="small"
                      aria-label={t("download")}
                      href={buildVersionDownloadUrl(version.id)}
                    >
                      <DownloadIcon fontSize="small" />
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
