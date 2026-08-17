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
import LinkButton from "@/components/ui/LinkButton";
import { formatDate } from "@/lib/utils/format";
import { tableContainerSx, tableHeadSx, tableRootSx } from "@/components/ui/tableStyles";
import SortableTableCell from "@/components/ui/SortableTableCell";
import { useTableSort } from "@/lib/hooks/useTableSort";

type IdeaForManagement = {
  id: string;
  title: string;
  visibility: string;
  status: string;
  createdAt: Date;
  slug: string;
};

type Props = {
  ideas: IdeaForManagement[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  getResolutionLabel: (status: string) => string;
};

/** 管理画面のアイデア一括操作テーブル（選択チェックボックス・ソート・行内リンクのみを担当） */
export default function BatchIdeaOperationsTable({ ideas, selected, onToggle, onToggleAll, getResolutionLabel }: Props) {
  const t = useTranslations("Idea.batch");
  const tCommon = useTranslations("Common");

  const { sorted, order, orderBy, handleSort } = useTableSort(ideas, {
    title: (i) => i.title,
    visibility: (i) => i.visibility,
    status: (i) => i.status,
    created: (i) => new Date(i.createdAt).getTime(),
  });

  return (
    <TableContainer component={Paper} sx={tableContainerSx}>
      <Table sx={[tableRootSx, { minWidth: 640 }]}>
        <TableHead sx={tableHeadSx}>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={selected.size > 0 && selected.size < ideas.length}
                checked={ideas.length > 0 && selected.size === ideas.length}
                onChange={onToggleAll}
              />
            </TableCell>
            <SortableTableCell columnKey="title" activeKey={orderBy} order={order} onSort={handleSort}>{t("colName")}</SortableTableCell>
            <SortableTableCell columnKey="visibility" activeKey={orderBy} order={order} onSort={handleSort}>{t("colStatus")}</SortableTableCell>
            <SortableTableCell columnKey="status" activeKey={orderBy} order={order} onSort={handleSort}>{t("colResolution")}</SortableTableCell>
            <SortableTableCell columnKey="created" activeKey={orderBy} order={order} onSort={handleSort}>{t("colCreated")}</SortableTableCell>
            <TableCell align="center">{t("colActions")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ideas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((i) => (
              <TableRow key={i.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox checked={selected.has(i.id)} onChange={() => onToggle(i.id)} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{i.title}</TableCell>
                <TableCell>{tCommon.has(`visibility.${i.visibility}` as never) ? tCommon(`visibility.${i.visibility}` as never) : i.visibility}</TableCell>
                <TableCell>{getResolutionLabel(i.status)}</TableCell>
                <TableCell>{formatDate(new Date(i.createdAt))}</TableCell>
                <TableCell align="center">
                  <LinkButton href={`/ideas/${i.id}`} size="small">
                    {t("view")}
                  </LinkButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
