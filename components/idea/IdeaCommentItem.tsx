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
import ReplyIcon from "@mui/icons-material/Reply";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";
import { updateIdeaComment, deleteIdeaComment, createIdeaComment } from "@/lib/actions/idea";
import { Link } from "@/i18n/routing";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";

export interface IdeaCommentData {
  id: string;
  content: string;
  contentFormat: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorUsername: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

interface IdeaCommentItemProps extends IdeaCommentData {
  /** 返信先アイデアID（返信フォーム送信に使用）。返信自身には渡さない */
  ideaId?: string;
  isLoggedIn?: boolean;
  replies?: IdeaCommentData[];
}

export default function IdeaCommentItem(props: IdeaCommentItemProps) {
  const { id, content, contentFormat, createdAt, updatedAt, authorName, authorAvatar, authorUsername, canEdit, canDelete, ideaId, isLoggedIn, replies = [] } = props;
  const t = useTranslations("Project.comments");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFormat, setReplyFormat] = useState("markdown");
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
      setError(err.content?.[0] || err.server?.[0] || "");
      setPending(false);
      return;
    }
    setEditing(false);
    setPending(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    setPending(true);
    const result = await deleteIdeaComment(id);
    if (result?.error) { setPending(false); return; }
    router.refresh();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !ideaId) return;
    setPending(true);
    const fd = new FormData();
    fd.set("content", replyText);
    fd.set("contentFormat", replyFormat);
    fd.set("parentId", id);
    await createIdeaComment(ideaId, fd);
    setReplyText("");
    setReplying(false);
    setPending(false);
    router.refresh();
  };

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <AuthorAvatar username={authorUsername} avatar={authorAvatar} name={authorName} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
          <AuthorName username={authorUsername} name={authorName} />
          <Typography variant="caption" color="text.secondary">
            {createdAt ? new Date(createdAt).toLocaleString() : ""}{isEdited ? "*" : ""}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {!editing && canEdit && (
            <IconButton size="small" onClick={() => setEditing(true)} disabled={pending}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
          )}
          {!editing && canDelete && (
            <IconButton size="small" color="error" onClick={handleDelete} disabled={pending}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
          )}
        </Box>

        {editing ? (
          <form onSubmit={handleSave}>
            <Stack spacing={2}>
              <TextField name="content" defaultValue={content} fullWidth multiline minRows={2} size="small" autoFocus error={!!error} helperText={error} disabled={pending} />
              <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>形式</InputLabel>
                  <Select name="contentFormat" defaultValue={contentFormat || "markdown"} label="形式" disabled={pending}>
                    <MenuItem value="markdown">Markdown</MenuItem>
                    <MenuItem value="plaintext">Plain Text</MenuItem>
                    <MenuItem value="pukiwiki">PukiWiki</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button size="small" onClick={() => { setEditing(false); setError(null); }} disabled={pending}>{t("cancel")}</Button>
                  <Button size="small" type="submit" variant="contained" disabled={pending}>{t("submit")}</Button>
                </Box>
              </Box>
            </Stack>
          </form>
        ) : (
          <Box sx={{ mt: 0.5 }}>
            <DescriptionRenderer content={content} format={contentFormat} />
          </Box>
        )}

        {ideaId && isLoggedIn && !editing && (
          <Button size="small" startIcon={<ReplyIcon fontSize="small" />} onClick={() => setReplying((v) => !v)} sx={{ mt: 0.5 }}>
            {t("reply")}
          </Button>
        )}

        {replying && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField multiline minRows={2} size="small" placeholder={t("replyPlaceholder")} value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={pending} />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>形式</InputLabel>
                <Select value={replyFormat} onChange={(e) => setReplyFormat(e.target.value)} label="形式" disabled={pending}>
                  <MenuItem value="markdown">Markdown</MenuItem>
                  <MenuItem value="plaintext">Plain Text</MenuItem>
                  <MenuItem value="pukiwiki">PukiWiki</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" onClick={() => setReplying(false)} disabled={pending}>{t("cancel")}</Button>
                <Button size="small" variant="contained" onClick={handleReply} disabled={pending || !replyText.trim()}>{t("submit")}</Button>
              </Box>
            </Box>
          </Stack>
        )}

        {replies.length > 0 && (
          <Box sx={{ mt: 2, pl: 2, borderLeft: "2px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 2 }}>
            {replies.map((r) => <IdeaCommentItem key={r.id} {...r} />)}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function AuthorAvatar({ username, avatar, name }: { username: string | null; avatar: string | null; name: string | null }) {
  const el = <Avatar src={avatar || undefined} sx={{ width: 40, height: 40 }}>{name?.[0] || "U"}</Avatar>;
  if (!username) return el;
  return <Link href={`/profile/${username}`} style={{ textDecoration: "none", color: "inherit" }}>{el}</Link>;
}

function AuthorName({ username, name }: { username: string | null; name: string | null }) {
  const el = <Typography variant="subtitle2" sx={{ fontWeight: 700, "&:hover": username ? { textDecoration: "underline" } : undefined }}>{name}</Typography>;
  if (!username) return el;
  return <Link href={`/profile/${username}`} style={{ textDecoration: "none", color: "inherit" }}>{el}</Link>;
}
