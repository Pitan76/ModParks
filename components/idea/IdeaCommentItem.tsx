"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplyIcon from "@mui/icons-material/Reply";
import { useTranslations } from "next-intl";
import { updateIdeaComment, deleteIdeaComment, createIdeaComment } from "@/lib/actions/idea";
import { Link } from "@/i18n/routing";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import CommentForm from "@/components/ui/CommentForm";

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
  const t = useTranslations("Comment");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdited = updatedAt && createdAt && updatedAt.getTime() - createdAt.getTime() > 1000;

  const handleEditSubmit = async (newContent: string, newFormat: string) => {
    setError(null);
    const fd = new FormData();
    fd.set("content", newContent);
    fd.set("contentFormat", newFormat);
    const result = await updateIdeaComment(id, fd);
    if (result?.error) {
      const err = result.error as Record<string, string[]>;
      setError(err.content?.[0] || err.server?.[0] || "");
      return false;
    }
    setEditing(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    setPending(true);
    const result = await deleteIdeaComment(id);
    if (result?.error) { setPending(false); return; }
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <CommentForm
              initialContent={content}
              initialFormat={contentFormat || "markdown"}
              placeholder={t("placeholder")}
              submitLabel={t("submit")}
              cancelLabel={t("cancel")}
              onSubmit={handleEditSubmit}
              onCancel={() => { setEditing(false); setError(null); }}
              size="small"
              minRows={2}
            />
            {error && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>
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
          <Box sx={{ mt: 1 }}>
            <CommentForm
              placeholder={t("replyPlaceholder")}
              submitLabel={t("submit")}
              cancelLabel={t("cancel")}
              onSubmit={async (text, format) => {
                if (!ideaId) return;
                const fd = new FormData();
                fd.set("content", text);
                fd.set("contentFormat", format);
                fd.set("parentId", id);
                await createIdeaComment(ideaId, fd);
                setReplying(false);
                router.refresh();
              }}
              onCancel={() => setReplying(false)}
              size="small"
              minRows={2}
            />
          </Box>
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
