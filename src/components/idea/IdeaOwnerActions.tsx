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
import { useTranslations } from "next-intl";
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
  const tCommon = useTranslations("Common");
  const tIdea = useTranslations("Idea");
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
        <IconButton size="small" aria-label={tCommon("edit")} onClick={() => setEditOpen(true)}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={tCommon("delete")} color="error" onClick={() => setDeleteOpen(true)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 編集ダイアログ */}
      <Dialog open={editOpen} onClose={() => !pending && setEditOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEdit}>
          <DialogTitle>{tIdea("editModal.title")}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {error?.server && (
                <Typography color="error" variant="body2">{error.server[0]}</Typography>
              )}
              <TextField
                name="title"
                label={tIdea("fields.title")}
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
                label={tIdea("fields.content")}
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
                <InputLabel>{tCommon("format")}</InputLabel>
                <Select name="contentFormat" label={tCommon("format")} defaultValue={initialContentFormat} disabled={pending}>
                  <MenuItem value="markdown">{tCommon("formatOptions.markdown")}</MenuItem>
                  <MenuItem value="plaintext">{tCommon("formatOptions.plaintext")}</MenuItem>
                  <MenuItem value="pukiwiki">{tCommon("formatOptions.pukiwiki")}</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>{tIdea("fields.visibility")}</InputLabel>
                <Select name="visibility" label={tIdea("fields.visibility")} defaultValue={initialVisibility} disabled={pending}>
                  <MenuItem value="public">{tCommon("visibility.public")}</MenuItem>
                  <MenuItem value="unlisted">{tCommon("visibility.unlisted")}</MenuItem>
                  <MenuItem value="private">{tCommon("visibility.private")}</MenuItem>
                  <MenuItem value="draft">{tCommon("visibility.draft")}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={pending}>{tCommon("cancel")}</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteOpen} onClose={() => !pending && setDeleteOpen(false)}>
        <DialogTitle>{tIdea("editModal.deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {tIdea("editModal.deleteConfirmDesc")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={pending}>{tCommon("cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
