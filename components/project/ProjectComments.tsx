"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslations } from "next-intl";
import ProjectCommentItem, { type Comment } from "./ProjectCommentItem";
import CommentForm from "@/components/ui/CommentForm";

interface Props {
  projectSlug: string;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export default function ProjectComments({ projectSlug, isLoggedIn, currentUserId }: Props) {
  const t = useTranslations("Project.comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const postComment = async (content: string, parentId?: string, format: string = "markdown") => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId, contentFormat: format }),
    });
    if (res.ok) await fetchComments();
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
      {isLoggedIn ? (
        <CommentForm
          title={`${t("title")} (${comments.length})`}
          placeholder={t("placeholder")}
          submitLabel={t("submit")}
          onSubmit={async (content, format) => {
            await postComment(content, undefined, format);
          }}
        />
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {t("title")} ({comments.length})
            </Typography>
          </Box>
          <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
            <Typography color="text.secondary">{t("loginPrompt")}</Typography>
          </Box>
        </>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 4 }}>
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
