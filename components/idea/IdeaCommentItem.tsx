"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { updateIdeaComment, deleteIdeaComment } from "@/lib/actions/idea";
import { Link } from "@/i18n/routing";

interface IdeaCommentItemProps {
  id: string;
  content: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorUsername: string | null;
  /** 本人のみ編集可 / 本人・管理者は削除可 */
  canEdit: boolean;
  canDelete: boolean;
}

export default function IdeaCommentItem({
  id,
  content,
  createdAt,
  updatedAt,
  authorName,
  authorAvatar,
  authorUsername,
  canEdit,
  canDelete,
}: IdeaCommentItemProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdited = updatedAt && createdAt && updatedAt.getTime() - createdAt.getTime() > 1000;

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateIdeaComment(id, new FormData(e.currentTarget));
    if (result?.error) {
      const err = result.error as Record<string, string[]>;
      setError(err.content?.[0] || err.server?.[0] || "更新に失敗しました");
      setPending(false);
      return;
    }
    setEditing(false);
    setPending(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("このコメントを削除しますか？")) return;
    setPending(true);
    const result = await deleteIdeaComment(id);
    if (result?.error) {
      setPending(false);
      return;
    }
    router.refresh();
  };

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      {authorUsername ? (
        <Link href={`/profile/${authorUsername}`} style={{ textDecoration: "none", color: "inherit" }}>
          <Avatar src={authorAvatar || undefined} sx={{ width: 40, height: 40 }}>
            {authorName?.[0] || "U"}
          </Avatar>
        </Link>
      ) : (
        <Avatar src={authorAvatar || undefined} sx={{ width: 40, height: 40 }}>
          {authorName?.[0] || "U"}
        </Avatar>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
          {authorUsername ? (
            <Link href={`/profile/${authorUsername}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, "&:hover": { textDecoration: "underline" } }}>
                {authorName}
              </Typography>
            </Link>
          ) : (
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {authorName}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {createdAt ? new Date(createdAt).toLocaleString() : ""}{isEdited ? "（編集済み）" : ""}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {!editing && canEdit && (
            <IconButton size="small" aria-label="コメントを編集" onClick={() => setEditing(true)} disabled={pending}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          {!editing && canDelete && (
            <IconButton size="small" aria-label="コメントを削除" color="error" onClick={handleDelete} disabled={pending}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>

        {editing ? (
          <form onSubmit={handleSave}>
            <Stack spacing={1}>
              <TextField
                name="content"
                defaultValue={content}
                fullWidth
                multiline
                minRows={2}
                size="small"
                autoFocus
                error={!!error}
                helperText={error}
                disabled={pending}
              />
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => { setEditing(false); setError(null); }} disabled={pending}>
                  キャンセル
                </Button>
                <Button size="small" type="submit" variant="contained" disabled={pending}>
                  {pending ? "保存中..." : "保存"}
                </Button>
              </Box>
            </Stack>
          </form>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {content}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
