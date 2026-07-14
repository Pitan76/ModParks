"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface ProjectForManagement {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  downloads: number | null;
  // externalDownloads は JSON オブジェクトのため合算には集計済みの totalDownloads を使う
  totalDownloads: number | null;
}

interface BatchProjectOperationsClientProps {
  projects: ProjectForManagement[];
}

export default function BatchProjectOperationsClient({ projects }: BatchProjectOperationsClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Menu state for status change
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

  const handleStatusClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
    } catch (err: any) {
      setError(err.message || "ステータス更新に失敗しました");
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
    } catch (err: any) {
      setError(err.message || "削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "public": return "公開";
      case "unlisted": return "限定公開";
      case "private": return "非公開";
      case "draft": return "下書き";
      default: return status;
    }
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
          ステータス変更
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleStatusClose}
        >
          <MenuItem onClick={() => handleBatchStatus("public")}>公開にする</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("unlisted")}>限定公開にする</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("private")}>非公開にする</MenuItem>
          <MenuItem onClick={() => handleBatchStatus("draft")}>下書きにする</MenuItem>
        </Menu>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
          disabled={selected.size === 0 || loading}
        >
          削除
        </Button>

        <Box sx={{ flexGrow: 1 }} />
        {selected.size > 0 && (
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {selected.size} 件選択中
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
              <TableCell>プロジェクト名</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>種類</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell align="right">総DL数</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  プロジェクトがありません
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
                        編集
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
        title="プロジェクト一括削除"
        description={<>本当に選択した <strong>{selected.size}</strong> 件のプロジェクトを削除しますか？この操作は元に戻せません。</>}
        expectedValue="DELETE"
        expectedValueLabel="確認のため、半角大文字で DELETE と入力してください:"
        pending={loading}
      />
    </Box>
  );
}
