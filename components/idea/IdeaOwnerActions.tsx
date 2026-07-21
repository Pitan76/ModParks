"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { updateIdea, deleteIdea } from "@/lib/actions/idea";

interface IdeaOwnerActionsProps {
  ideaId: string;
  initialTitle: string;
  initialContent: string;
  initialContentFormat: string;
  initialVisibility: string;
}

/** アイデア投稿者・管理者向けの編集/削除操作 */
export default function IdeaOwnerActions({
  ideaId,
  initialTitle,
  initialContent,
  initialContentFormat,
  initialVisibility,
}: IdeaOwnerActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Record<string, string[]> | null>(null);

  const handleEdit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateIdea(ideaId, new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error as Record<string, string[]>);
      setPending(false);
      return;
    }
    setEditOpen(false);
    setPending(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setPending(true);
    const result = await deleteIdea(ideaId);
    if (result?.error) {
      setPending(false);
      return;
    }
    router.push("/ideas");
  };

  return (
    <>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <IconButton size="small" aria-label="編集" onClick={() => setEditOpen(true)}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label="削除" color="error" onClick={() => setDeleteOpen(true)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 編集ダイアログ */}
      <Dialog open={editOpen} onClose={() => !pending && setEditOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEdit}>
          <DialogTitle>アイデアを編集</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {error?.server && (
                <Typography color="error" variant="body2">{error.server[0]}</Typography>
              )}
              <TextField
                name="title"
                label="タイトル"
                defaultValue={initialTitle}
                fullWidth
                required
                size="small"
                error={!!error?.title}
                helperText={error?.title?.[0]}
                disabled={pending}
              />
              <TextField
                name="content"
                label="内容"
                defaultValue={initialContent}
                fullWidth
                required
                multiline
                rows={6}
                error={!!error?.content}
                helperText={error?.content?.[0]}
                disabled={pending}
              />
              <FormControl fullWidth size="small">
                <InputLabel>形式</InputLabel>
                <Select name="contentFormat" label="形式" defaultValue={initialContentFormat} disabled={pending}>
                  <MenuItem value="markdown">Markdown</MenuItem>
                  <MenuItem value="plaintext">Plain Text</MenuItem>
                  <MenuItem value="pukiwiki">PukiWiki</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>公開範囲</InputLabel>
                <Select name="visibility" label="公開範囲" defaultValue={initialVisibility} disabled={pending}>
                  <MenuItem value="public">公開</MenuItem>
                  <MenuItem value="unlisted">限定公開</MenuItem>
                  <MenuItem value="private">非公開</MenuItem>
                  <MenuItem value="draft">下書き</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={pending}>キャンセル</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "保存中..." : "保存"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteOpen} onClose={() => !pending && setDeleteOpen(false)}>
        <DialogTitle>アイデアを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            この操作は取り消せません。関連するコメントやいいねもすべて削除されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={pending}>キャンセル</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={pending}>
            {pending ? "削除中..." : "削除"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
