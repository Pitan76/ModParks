"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
}

export default function ProjectComments({ projectSlug, isLoggedIn, currentUserId }: { projectSlug: string, isLoggedIn: boolean, currentUserId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const t = useTranslations("Project");

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}/comments`);
      if (res.ok) {
        const data = (await res.json()) as Comment[];
        setComments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [projectSlug]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchComments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
        コメント ({comments.length})
      </Typography>

      {isLoggedIn ? (
        <Box sx={{ mb: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            multiline
            minRows={3}
            placeholder="プロジェクトについてコメントする..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={posting}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={handleSubmit} disabled={posting || !newComment.trim()}>
              投稿する
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
          <Typography color="text.secondary">
            コメントするにはログインしてください。
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {comments.map((comment) => (
          <Box key={comment.id} sx={{ display: "flex", gap: 2 }}>
            <Avatar src={comment.authorAvatar || undefined} sx={{ width: 40, height: 40 }}>
              {comment.authorName?.[0] || "U"}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5, justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {comment.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                {currentUserId === comment.authorId && (
                  <IconButton size="small" color="error" onClick={() => handleDelete(comment.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {comment.content}
              </Typography>
            </Box>
          </Box>
        ))}
        {comments.length === 0 && (
          <Typography color="text.secondary">まだコメントはありません。</Typography>
        )}
      </Box>
    </Box>
  );
}
