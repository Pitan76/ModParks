"use client";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useFormatter, useTranslations } from "next-intl";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import type { ParsedVersion, ProjectVersion } from "./useVersionsManager";

type Props = {
  parsedVersions: ParsedVersion[];
  isEmpty: boolean;
  extractingId: string | null;
  archivingId: string | null;
  onExtract: (versionId: string) => void;
  onToggleArchive: (v: ProjectVersion) => void;
  onEdit: (v: ProjectVersion) => void;
  onDelete: (id: string) => void;
};

export default function VersionsManagerTable({
  parsedVersions,
  isEmpty,
  extractingId,
  archivingId,
  onExtract,
  onToggleArchive,
  onEdit,
  onDelete,
}: Props) {
  const format = useFormatter();
  const t = useTranslations("Version");

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ width: "100%", maxWidth: "100%", overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t("manager.columns.version")}</TableCell>
            <TableCell>{t("manager.columns.mc")}</TableCell>
            <TableCell>{t("manager.columns.downloads")}</TableCell>
            <TableCell>{t("manager.columns.date")}</TableCell>
            <TableCell align="right">{t("manager.columns.actions")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {parsedVersions.map((v) => {
            const isArchived = !!v.archivedAt;
            return (
              <TableRow key={v.id} sx={isArchived ? { opacity: 0.6, bgcolor: "action.hover" } : undefined}>
                <TableCell sx={{ fontWeight: "bold" }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <span>{v.versionNumber}</span>
                    <ReleaseChannelChip channel={v.releaseChannel} />
                    {isArchived && <Chip label={t("manager.archivedLabel")} size="small" color="default" variant="outlined" />}
                  </Stack>
                </TableCell>
                <TableCell>{v.parsedMcVersions.join(", ")}</TableCell>
                <TableCell>{v.downloads}</TableCell>
                <TableCell>{format.dateTime(v.date, { dateStyle: "short", timeStyle: "short" })}</TableCell>
                <TableCell align="right">
                  <Tooltip title={t("manager.extractRecipes")}>
                    <span>
                      <IconButton color="secondary" onClick={() => onExtract(v.id)} disabled={!!extractingId || !v.canExtractRecipes}>
                        {extractingId === v.id ? <CircularProgress size={24} color="inherit" /> : <AutoFixHighIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={isArchived ? t("manager.unarchive") : t("manager.archive")}>
                    <span>
                      <IconButton color="default" onClick={() => onToggleArchive(v)} disabled={archivingId === v.id}>
                        {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton color="primary" onClick={() => onEdit(v)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => onDelete(v.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
          {isEmpty && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                {t("manager.noVersions")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
