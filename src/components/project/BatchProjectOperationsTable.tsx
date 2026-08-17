"use client";

import { useTranslations } from "next-intl";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { formatCompactNumber } from "@/lib/utils/format";
import LinkButton from "@/components/ui/LinkButton";
import ProjectVersionCell from "./ProjectVersionCell";
import { tableContainerSx, tableHeadSx, tableRootSx } from "@/components/ui/tableStyles";
import SortableTableCell from "@/components/ui/SortableTableCell";
import { useTableSort } from "@/lib/hooks/useTableSort";

type ProjectForManagement = {
  id: string;
  slug: string;
  title: string;
  type: string;
  visibility: string;
  downloads: number | null;
  totalDownloads: number | null;
  githubRepo?: string | null;
  latestVersionNumber?: string | null;
};

type Props = {
  projects: ProjectForManagement[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  getStatusLabel: (status: string) => string;
};

/** 管理画面の一括操作テーブル（選択チェックボックス・ソート・行内リンクのみを担当） */
export default function BatchProjectOperationsTable({ projects, selected, onToggle, onToggleAll, getStatusLabel }: Props) {
  const t = useTranslations("Project.batch");

  const { sorted, order, orderBy, handleSort } = useTableSort(projects, {
    name: (p) => p.title,
    slug: (p) => p.slug,
    type: (p) => p.type,
    status: (p) => p.visibility,
    downloads: (p) => p.totalDownloads || 0,
  });

  return (
    <TableContainer component={Paper} sx={tableContainerSx}>
      <Table sx={[tableRootSx, { minWidth: 640 }]}>
        <TableHead sx={tableHeadSx}>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={selected.size > 0 && selected.size < projects.length}
                checked={projects.length > 0 && selected.size === projects.length}
                onChange={onToggleAll}
              />
            </TableCell>
            <SortableTableCell columnKey="name" activeKey={orderBy} order={order} onSort={handleSort}>{t("colName")}</SortableTableCell>
            <SortableTableCell columnKey="slug" activeKey={orderBy} order={order} onSort={handleSort}>{t("colSlug")}</SortableTableCell>
            <SortableTableCell columnKey="type" activeKey={orderBy} order={order} onSort={handleSort}>{t("colType")}</SortableTableCell>
            <SortableTableCell columnKey="status" activeKey={orderBy} order={order} onSort={handleSort}>{t("colStatus")}</SortableTableCell>
            <SortableTableCell columnKey="downloads" activeKey={orderBy} order={order} onSort={handleSort} align="right">{t("colDownloads")}</SortableTableCell>
            <TableCell align="center">{t("colVersion")}</TableCell>
            <TableCell align="center">{t("colActions")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((p) => {
              const totalDl = p.totalDownloads || 0;
              return (
                <TableRow key={p.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.has(p.id)} onChange={() => onToggle(p.id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                  <TableCell>{p.slug}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>{getStatusLabel(p.visibility)}</TableCell>
                  <TableCell align="right">{formatCompactNumber(totalDl, "ja")}</TableCell>
                  <TableCell align="center">
                    <ProjectVersionCell
                      projectId={p.id}
                      projectSlug={p.slug}
                      githubRepo={p.githubRepo || null}
                      latestVersionNumber={p.latestVersionNumber || null}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <LinkButton href={`/projects/${p.slug}/edit`} size="small">
                      {t("edit")}
                    </LinkButton>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
