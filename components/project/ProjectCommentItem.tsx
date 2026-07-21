"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplyIcon from "@mui/icons-material/Reply";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";

export interface Comment {
  id: string;
  content: string;
  contentFormat: string | null;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
}

interface Props {
  comment: Comment;
  replies: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string, format: string) => Promise<void>;
}

export default function ProjectCommentItem({ comment, replies, isLoggedIn, currentUserId, onDelete, onReply }: Props) {
  const t = useTranslations("Project.comments");
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFormat, setReplyFormat] = useState("markdown");
  const [posting, setPosting] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      await onReply(comment.id, replyText, replyFormat);
      setReplyText("");
      setReplying(false);
    } finally {
      setPosting(false);
    }
  };

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
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>形式</InputLabel>
                <Select
                  value={replyFormat}
                  label="形式"
                  onChange={(e) => setReplyFormat(e.target.value)}
                  disabled={posting}
                >
                  <MenuItem value="markdown">Markdown</MenuItem>
                  <MenuItem value="plaintext">Plain Text</MenuItem>
                  <MenuItem value="pukiwiki">PukiWiki</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <TextField
              multiline minRows={2} size="small"
              placeholder={t("replyPlaceholder")}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={posting}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button size="small" onClick={() => setReplying(false)} disabled={posting}>{t("cancel")}</Button>
              <Button size="small" variant="contained" onClick={submitReply} disabled={posting || !replyText.trim()}>
                {t("submit")}
              </Button>
            </Box>
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
}

function Header({ comment, currentUserId, onDelete }: { comment: Comment; currentUserId?: string; onDelete: (id: string) => void }) {
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
}
