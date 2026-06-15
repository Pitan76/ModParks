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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useState } from "react";
import { deleteVersion } from "@/lib/actions/version";
import { useFormatter } from "next-intl";

export interface ProjectVersion {
  id: string;
  versionNumber: string;
  mcVersions: string;
  loaders: string;
  createdAt: Date;
  downloads: number;
}

export interface ProjectVersionsManagerProps {
  projectSlug: string;
  versions: ProjectVersion[];
}

export default function ProjectVersionsManager({ projectSlug, versions: initialVersions }: ProjectVersionsManagerProps) {
  const format = useFormatter();
  const [localVersions, setLocalVersions] = useState(initialVersions);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        アップロードされたバージョン（ファイル）の一覧と管理を行います。
      </Typography>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>バージョン</TableCell>
              <TableCell>対応MC</TableCell>
              <TableCell>DL数</TableCell>
              <TableCell>アップロード日時</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {localVersions.map((v) => {
              const mcvs = JSON.parse(v.mcVersions) as string[];
              return (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontWeight: "bold" }}>{v.versionNumber}</TableCell>
                  <TableCell>{mcvs.join(", ")}</TableCell>
                  <TableCell>{v.downloads}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(v.createdAt), { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell align="right">
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

      <Dialog open={!!deleteId} onClose={() => !pending && setDeleteId(null)}>
        <DialogTitle>バージョンを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は取り消せません。削除するとユーザーはこのバージョンをダウンロードできなくなります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={pending}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={pending}>
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
