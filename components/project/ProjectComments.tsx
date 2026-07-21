"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";
import ProjectCommentItem, { type Comment } from "./ProjectCommentItem";

interface Props {
  projectSlug: string;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export default function ProjectComments({ projectSlug, isLoggedIn, currentUserId }: Props) {
  const t = useTranslations("Project.comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [contentFormat, setContentFormat] = useState("markdown");
  const [posting, setPosting] = useState(false);

  const endpoint = `/api/v1/projects/${projectSlug}/comments`;

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (res.ok) setComments((await res.json()) as Comment[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // 非同期 fetch のため setState は同期実行されない（false positive 回避）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchComments();
  }, [fetchComments]);

  const postComment = async (content: string, parentId?: string, format: string = contentFormat) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId, contentFormat: format }),
    });
    if (res.ok) await fetchComments();
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await postComment(newComment);
      setNewComment("");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`${endpoint}/${commentId}`, { method: "DELETE" });
      if (res.ok) await fetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>;
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
        {t("title")} ({comments.length})
      </Typography>

      {isLoggedIn ? (
        <Box sx={{ mb: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>形式</InputLabel>
              <Select
                value={contentFormat}
                label="形式"
                onChange={(e) => setContentFormat(e.target.value)}
                disabled={posting}
              >
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="plaintext">Plain Text</MenuItem>
                <MenuItem value="pukiwiki">PukiWiki</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            multiline minRows={3}
            placeholder={t("placeholder")}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={posting}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={handleSubmit} disabled={posting || !newComment.trim()}>
              {t("submit")}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
          <Typography color="text.secondary">{t("loginPrompt")}</Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {topLevel.map((comment) => (
          <ProjectCommentItem
            key={comment.id}
            comment={comment}
            replies={repliesOf(comment.id)}
            isLoggedIn={isLoggedIn}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onReply={(parentId, content, format) => postComment(content, parentId, format)}
          />
        ))}
        {topLevel.length === 0 && <Typography color="text.secondary">{t("empty")}</Typography>}
      </Box>
    </Box>
  );
}
