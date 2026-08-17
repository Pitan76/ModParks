"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Link, useRouter } from "@/lib/i18n/routing";
import { formatDate } from "@/lib/utils/format";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import { tableContainerSx, tableHeadSx, tableRootSx } from "@/components/ui/tableStyles";
import SortableTableCell from "@/components/ui/SortableTableCell";
import { useTableSort } from "@/lib/hooks/useTableSort";
import {
  batchUpdateIdeaStatus,
  batchUpdateIdeaResolution,
  batchDeleteIdeas,
  batchModifyIdeaMetadata,
} from "@/lib/actions/ideaBatch";
import BatchIdeaMetadataDialog from "./BatchIdeaMetadataDialog";

type IdeaForManagement = {
  id: string;
  title: string;
  visibility: string;
  status: string;
  createdAt: Date;
  slug: string;
};

interface OptionItem {
  slug: string;
  name: string;
}

export type BatchIdeaOperationsClientProps = {
  ideas: IdeaForManagement[];
  availableTags: OptionItem[];
  availablePlatforms: OptionItem[];
};

export default function BatchIdeaOperationsClient({
  ideas,
  availableTags = [],
  availablePlatforms = [],
}: BatchIdeaOperationsClientProps) {
  const router = useRouter();
  const t = useTranslations("Idea.batch");
  const tIdea = useTranslations("Idea");
  const tCommon = useTranslations("Common");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);

  const [visibilityAnchorEl, setVisibilityAnchorEl] = useState<null | HTMLElement>(null);
  const [resolutionAnchorEl, setResolutionAnchorEl] = useState<null | HTMLElement>(null);

  const { sorted, order, orderBy, handleSort } = useTableSort(ideas, {
    title: (i) => i.title,
    visibility: (i) => i.visibility,
    status: (i) => i.status,
    created: (i) => new Date(i.createdAt).getTime(),
  });

  const handleToggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    if (selected.size === ideas.length) setSelected(new Set());
    else setSelected(new Set(ideas.map((i) => i.id)));
  };

  const handleBatchStatus = async (status: "public" | "unlisted" | "private" | "draft") => {
    setVisibilityAnchorEl(null);
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await batchUpdateIdeaStatus(Array.from(selected), status);
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchResolution = async (status: "open" | "in_progress" | "fulfilled") => {
    setResolutionAnchorEl(null);
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await batchUpdateIdeaResolution(Array.from(selected), status);
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await batchDeleteIdeas(Array.from(selected));
      setSelected(new Set());
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("deleteError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchMetadataSubmit = async (
    operation: "add" | "remove" | "set",
    mcVersions: string[],
    loaders: string[],
    tags: string[],
    targets: { mcVersions: boolean; loaders: boolean; tags: boolean }
  ) => {
    if (selected.size === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await batchModifyIdeaMetadata(
        Array.from(selected),
        operation,
        mcVersions,
        loaders,
        tags,
        targets
      );
      if (res && "error" in res) {
        setError(res.error || t("statusUpdateError"));
        return false;
      }
      setSelected(new Set());
      router.refresh();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getResolutionLabel = (status: string) => {
    if (status === "open") return tIdea("status.open");
    if (status === "in_progress") return tIdea("status.in_progress");
    return tIdea("status.resolved");
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ mb: 2, display: "flex", gap: { xs: 1, sm: 2 }, alignItems: "center", flexWrap: "wrap" }}>
        {/* 公開範囲 */}
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={(e) => setVisibilityAnchorEl(e.currentTarget)}
          disabled={selected.size === 0 || loading}
        >
          {t("changeStatus")}
        </Button>
        <Menu anchorEl={visibilityAnchorEl} open={Boolean(visibilityAnchorEl)} onClose={() => setVisibilityAnchorEl(null)}>
          <MenuItem onClick={() => handleBatchStatus("public")}>{tCommon("visibility.public")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("unlisted")}>{tCommon("visibility.unlisted")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("private")}>{tCommon("visibility.private")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("draft")}>{tCommon("visibility.draft")}</MenuItem>
        </Menu>

        {/* 解決ステータス */}
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={(e) => setResolutionAnchorEl(e.currentTarget)}
          disabled={selected.size === 0 || loading}
        >
          {t("changeResolution")}
        </Button>
        <Menu anchorEl={resolutionAnchorEl} open={Boolean(resolutionAnchorEl)} onClose={() => setResolutionAnchorEl(null)}>
          <MenuItem onClick={() => handleBatchResolution("open")}>{tIdea("status.open")}</MenuItem>
          <MenuItem onClick={() => handleBatchResolution("in_progress")}>{tIdea("status.in_progress")}</MenuItem>
          <MenuItem onClick={() => handleBatchResolution("fulfilled")}>{tIdea("status.resolved")}</MenuItem>
        </Menu>

        {/* メタデータ編集 */}
        <Button
          variant="contained"
          color="secondary"
          startIcon={<EditIcon />}
          onClick={() => setMetadataDialogOpen(true)}
          disabled={selected.size === 0 || loading}
        >
          {t("editMetadata")}
        </Button>

        {/* 削除 */}
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
          disabled={selected.size === 0 || loading}
        >
          {t("delete")}
        </Button>

        <Box sx={{ flexGrow: 1 }} />
        {selected.size > 0 && (
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {t("selectedCount", { count: selected.size })}
          </Box>
        )}
      </Box>

      <TableContainer component={Paper} sx={tableContainerSx}>
        <Table sx={[tableRootSx, { minWidth: 640 }]}>
          <TableHead sx={tableHeadSx}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < ideas.length}
                  checked={ideas.length > 0 && selected.size === ideas.length}
                  onChange={handleToggleAll}
                />
              </TableCell>
              <SortableTableCell columnKey="title" activeKey={orderBy} order={order} onSort={handleSort}>{t("colName")}</SortableTableCell>
              <SortableTableCell columnKey="visibility" activeKey={orderBy} order={order} onSort={handleSort}>{t("colStatus")}</SortableTableCell>
              <SortableTableCell columnKey="status" activeKey={orderBy} order={order} onSort={handleSort}>{t("colResolution")}</SortableTableCell>
              <SortableTableCell columnKey="created" activeKey={orderBy} order={order} onSort={handleSort}>{tCommon("created") || "Created"}</SortableTableCell>
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
                    <Checkbox checked={selected.has(i.id)} onChange={() => handleToggle(i.id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{i.title}</TableCell>
                  <TableCell>{tCommon(`visibility.${i.visibility}` as any) || i.visibility}</TableCell>
                  <TableCell>{getResolutionLabel(i.status)}</TableCell>
                  <TableCell>{formatDate(new Date(i.createdAt))}</TableCell>
                  <TableCell align="center">
                    <Button component={Link} href={`/ideas/${i.id}`} size="small">
                      {tCommon("view") || "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TypedConfirmDialog
        open={deleteDialogOpen}
        onClose={() => !loading && setDeleteDialogOpen(false)}
        onConfirm={handleBatchDelete}
        title={t("deleteTitle")}
        description={t.rich("deleteDescription", { count: selected.size, b: (chunks) => <strong>{chunks}</strong> })}
        expectedValue="DELETE"
        expectedValueLabel={t("deleteConfirmLabel")}
        pending={loading}
      />

      <BatchIdeaMetadataDialog
        open={metadataDialogOpen}
        onClose={() => setMetadataDialogOpen(false)}
        selectedCount={selected.size}
        availableTags={availableTags}
        availablePlatforms={availablePlatforms}
        pending={loading}
        onSubmit={handleBatchMetadataSubmit}
      />
    </Box>
  );
}
