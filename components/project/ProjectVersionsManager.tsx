"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Autocomplete, { AutocompleteRenderGetTagProps } from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { deleteVersion, updateVersion } from "@/lib/actions/version";
import { useFormatter, useTranslations } from "next-intl";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { MC_VERSIONS } from "@/lib/validations";
import { AVAILABLE_LOADERS, getLoaderInfo } from "@/lib/loaders";

export interface ProjectVersion {
  id: string;
  versionNumber: string;
  mcVersions: string;
  loaders: string;
  createdAt: Date;
  downloads: number;
  changelog: string;
}

export interface ProjectVersionsManagerProps {
  projectSlug: string;
  versions: ProjectVersion[];
  openIdeas: { id: string; title: string }[];
}

export default function ProjectVersionsManager({ projectSlug, versions: initialVersions, openIdeas }: ProjectVersionsManagerProps) {
  const format = useFormatter();
  const tCommon = useTranslations("Common");
  const [localVersions, setLocalVersions] = useState(initialVersions);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectVersion | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [editError, setEditError] = useState<{ [key: string]: string[] } | null>(null);

  // Edit State
  const [editNumber, setEditNumber] = useState("");
  const [editChangelog, setEditChangelog] = useState("");
  const [editMc, setEditMc] = useState<string[]>([]);
  const [editLoaders, setEditLoaders] = useState<string[]>([]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setPending(true);
    setErrorMsg("");

    try {
      const res = await deleteVersion(deleteId, projectSlug);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setLocalVersions(prev => prev.filter(v => v.id !== deleteId));
        setDeleteId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete version");
    } finally {
      setPending(false);
    }
  };

  const openEdit = (v: ProjectVersion) => {
    setEditTarget(v);
    setEditNumber(v.versionNumber);
    setEditChangelog(v.changelog || "");
    try {
      setEditMc(JSON.parse(v.mcVersions) || []);
      setEditLoaders(JSON.parse(v.loaders) || []);
    } catch {
      setEditMc([]);
      setEditLoaders([]);
    }
    setEditError(null);
  };

  const handleEditSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setPending(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("versionNumber", editNumber);
    formData.append("changelog", editChangelog);
    editMc.forEach(mc => formData.append("mcVersions", mc));
    editLoaders.forEach(l => formData.append("loaders", l));

    try {
      const res = await updateVersion(editTarget.id, projectSlug, formData);
      if (res.error) {
        setEditError(res.error as any);
      } else {
        setLocalVersions(prev => prev.map(v => v.id === editTarget.id ? {
          ...v,
          versionNumber: editNumber,
          changelog: editChangelog,
          mcVersions: JSON.stringify(editMc),
          loaders: JSON.stringify(editLoaders)
        } : v));
        setEditTarget(null);
      }
    } catch(err: any) {
      setEditError({ server: [err.message] });
    } finally {
      setPending(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          アップロードされたバージョン（ファイル）の一覧と管理を行います。
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>
          バージョンを追加
        </Button>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>バージョン</TableCell>
              <TableCell>対応MC</TableCell>
              <TableCell>DL数</TableCell>
              <TableCell>日時</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {localVersions.map((v) => {
              let mcvs: string[] = [];
              try { mcvs = JSON.parse(v.mcVersions) as string[]; } catch {}
              return (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontWeight: "bold" }}>{v.versionNumber}</TableCell>
                  <TableCell>{mcvs.join(", ")}</TableCell>
                  <TableCell>{v.downloads}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(v.createdAt), { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="primary" onClick={() => openEdit(v)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => setDeleteId(v.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {localVersions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  バージョンがありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onClose={() => !pending && setDeleteId(null)}>
        <DialogTitle>バージョンを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。削除するとユーザーはこのバージョンをダウンロードできなくなります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={pending} variant="text">{tCommon("cancel")}</Button>
          <Button color="error" variant="text" onClick={handleDelete} disabled={pending}>
            削除する
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onClose={() => !pending && setEditTarget(null)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle>バージョンの編集</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
            {editError?.server && <Alert severity="error">{editError.server[0]}</Alert>}
            
            <TextField
              label="バージョン番号"
              value={editNumber}
              onChange={e => setEditNumber(e.target.value)}
              fullWidth
              required
              size="small"
              error={!!editError?.versionNumber}
              helperText={editError?.versionNumber?.[0]}
              sx={{ mt: 1 }}
            />

            <Autocomplete
              multiple
              options={MC_VERSIONS}
              value={editMc}
              onChange={(_, val) => setEditMc(val)}
              renderInput={(params) => (
                <TextField {...params} label="対応Minecraftバージョン" required={editMc.length === 0} error={!!editError?.mcVersions} helperText={editError?.mcVersions?.[0]} />
              )}
            />

            <Autocomplete
              multiple
              options={AVAILABLE_LOADERS}
              getOptionLabel={(id) => getLoaderInfo(id).name}
              value={editLoaders}
              onChange={(_, val) => setEditLoaders(val)}
              renderInput={(params) => (
                <TextField {...params} label="対応ローダー" required={editLoaders.length === 0} error={!!editError?.loaders} helperText={editError?.loaders?.[0]} />
              )}
              // @ts-expect-error MUI typing issue with renderTags signature resolution
              renderTags={(val: string[], getTagProps: AutocompleteRenderGetTagProps) => val.map((id, idx) => {
                const { key, ...tagProps } = getTagProps({ index: idx });
                return <Chip key={key} label={getLoaderInfo(id).name} size="small" {...tagProps} />;
              })}
            />

            <TextField
              label="変更履歴"
              value={editChangelog}
              onChange={e => setEditChangelog(e.target.value)}
              fullWidth
              multiline
              rows={4}
              error={!!editError?.changelog}
              helperText={editError?.changelog?.[0]}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditTarget(null)} disabled={pending} variant="text">{tCommon("cancel")}</Button>
            <Button type="submit" variant="text" disabled={pending}>保存</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>新しいバージョンをアップロード</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Box sx={{ mt: 2 }}>
            <VersionUploadForm slug={projectSlug} openIdeas={openIdeas} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
