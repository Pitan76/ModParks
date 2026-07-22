"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
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
import { formatCompactNumber } from "@/lib/utils/format";
import { Link } from "@/i18n/routing";
import { batchUpdateProjectStatus, batchDeleteProjects } from "@/lib/actions/project";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";

type ProjectForManagement = {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  downloads: number | null;
  totalDownloads: number | null;
};

export type BatchProjectOperationsClientProps = {
  projects: ProjectForManagement[];
};

/**
 * 管理画面で複数プロジェクトの一括公開ステータス変更、または一括削除操作を提供するクライアントコンポーネント。
 */
const BatchProjectOperationsClient = ({ projects }: BatchProjectOperationsClientProps) => {
  const router = useRouter();
  const t = useTranslations("Project.batch");
  const tCommon = useTranslations("Common");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleToggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    if (selected.size === projects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map(p => p.id)));
    }
  };

  const handleStatusClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleStatusClose = () => {
    setAnchorEl(null);
  };

  const handleBatchStatus = async (status: "public" | "unlisted" | "private" | "draft") => {
    handleStatusClose();
    if (selected.size === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      await batchUpdateProjectStatus(ids, status);
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
      const ids = Array.from(selected);
      await batchDeleteProjects(ids);
      setSelected(new Set());
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("deleteError"));
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    if (tCommon.has(`visibility.${status}` as any)) return tCommon(`visibility.${status}` as any);
    return status;
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ mb: 2, display: "flex", gap: { xs: 1, sm: 2 }, alignItems: "center", flexWrap: "wrap" }}>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleStatusClick}
          disabled={selected.size === 0 || loading}
        >
          {t("changeStatus")}
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleStatusClose}
        >
          <MenuItem onClick={() => handleBatchStatus("public")}>{t("makePublic")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("unlisted")}>{t("makeUnlisted")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("private")}>{t("makePrivate")}</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("draft")}>{t("makeDraft")}</MenuItem>
        </Menu>

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

      <TableContainer component={Paper} variant="outlined">
        <Table sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < projects.length}
                  checked={projects.length > 0 && selected.size === projects.length}
                  onChange={handleToggleAll}
                />
              </TableCell>
              <TableCell>{t("colName")}</TableCell>
              <TableCell>{t("colSlug")}</TableCell>
              <TableCell>{t("colType")}</TableCell>
              <TableCell>{t("colStatus")}</TableCell>
              <TableCell align="right">{t("colDownloads")}</TableCell>
              <TableCell align="center">{t("colActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => {
                const totalDl = p.totalDownloads || 0;
                return (
                  <TableRow key={p.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox 
                        checked={selected.has(p.id)} 
                        onChange={() => handleToggle(p.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                    <TableCell>{p.slug}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell>{getStatusLabel(p.status)}</TableCell>
                    <TableCell align="right">{formatCompactNumber(totalDl, "ja")}</TableCell>
                    <TableCell align="center">
                      <Button component={Link} href={`/projects/${p.slug}/edit`} size="small">
                        {t("edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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
    </Box>
  );
};

export default BatchProjectOperationsClient;
