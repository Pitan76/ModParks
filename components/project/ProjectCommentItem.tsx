"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplyIcon from "@mui/icons-material/Reply";
import { useTranslations } from "next-intl";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import CommentForm from "@/components/ui/CommentForm";

export type Comment = {
  id: string;
  content: string;
  contentFormat: string | null;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
};

type ProjectCommentItemProps = {
  comment: Comment;
  replies: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string, format: string) => Promise<void>;
};

type HeaderProps = {
  comment: Comment;
  currentUserId?: string;
  onDelete: (id: string) => void;
};

const Header = ({ comment, currentUserId, onDelete }: HeaderProps) => {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5, justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{comment.authorName}</Typography>
        <Typography variant="caption" color="text.secondary">{new Date(comment.createdAt).toLocaleString()}</Typography>
      </Box>
      {currentUserId === comment.authorId && (
        <IconButton size="small" color="error" onClick={() => onDelete(comment.id)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

/**
 * プロジェクトコメントの個別アイテムを描画するコンポーネント。
 * 返信の一覧表示と、ログインユーザーによる返信フォーム、削除機能を提供します。
 */
const ProjectCommentItem = ({
  comment,
  replies,
  isLoggedIn,
  currentUserId,
  onDelete,
  onReply,
}: ProjectCommentItemProps) => {
  const t = useTranslations("Comment");
  const [replying, setReplying] = useState(false);

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Avatar src={comment.authorAvatar || undefined} sx={{ width: 40, height: 40 }}>
        {comment.authorName?.[0] || "U"}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Header comment={comment} currentUserId={currentUserId} onDelete={onDelete} />
        <Box sx={{ mt: 0.5 }}>
          <DescriptionRenderer content={comment.content} format={comment.contentFormat} />
        </Box>

        {isLoggedIn && (
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
              onSubmit={async (content, format) => {
                await onReply(comment.id, content, format);
                setReplying(false);
              }}
              onCancel={() => setReplying(false)}
              size="small"
              minRows={2}
            />
          </Box>
        )}

        {replies.length > 0 && (
          <Box sx={{ mt: 2, pl: 2, borderLeft: "2px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 2 }}>
            {replies.map((r) => (
              <Box key={r.id} sx={{ display: "flex", gap: 2 }}>
                <Avatar src={r.authorAvatar || undefined} sx={{ width: 32, height: 32 }}>{r.authorName?.[0] || "U"}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Header comment={r} currentUserId={currentUserId} onDelete={onDelete} />
                  <Box sx={{ mt: 0.5 }}>
                    <DescriptionRenderer content={r.content} format={r.contentFormat} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ProjectCommentItem;
