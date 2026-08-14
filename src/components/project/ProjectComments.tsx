"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import ProjectCommentItem, { type Comment } from "./ProjectCommentItem";
import CommentForm from "@/components/ui/CommentForm";
import { useColorMode } from "@/components/ThemeRegistry";
import PlainProjectComments from "@/components/plain/project/PlainProjectComments";

/** 1回に読み込む親コメント(スレッド)の件数 */
const COMMENTS_PAGE_SIZE = 10;

type ProjectCommentsProps = {
  projectSlug: string;
  isLoggedIn: boolean;
  currentUserId?: string;
  defaultCommentBodyFormat?: string;
};

/**
 * プロジェクトに対するコメントスレッド全体を表示・管理するクライアントコンポーネント。
 * 新規コメント・返信の投稿、コメントの削除、及び一覧の非同期取得を行います。
 */
const ProjectComments = ({ projectSlug, isLoggedIn, currentUserId, defaultCommentBodyFormat }: ProjectCommentsProps) => {
  const t = useTranslations("Comment");
  const tCommon = useTranslations("Common");
  const { isPlainTheme } = useColorMode();
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const endpoint = `/api/v1/projects/${projectSlug}/comments`;

  /** 親コメントを limit 件、先頭から読み込み直す（新規投稿・削除後の再取得に使う） */
  const fetchComments = useCallback(async (limit: number) => {
    try {
      const res = await fetch(`${endpoint}?limit=${limit}&offset=0`);
      if (!res.ok) return;
      setComments((await res.json()) as Comment[]);
      setTotalThreads(Number(res.headers.get("X-Comments-Total") ?? 0));
    } catch (err) {
      console.error(err);
    }
  }, [endpoint]);

  useEffect(() => {
    (async () => {
      await fetchComments(COMMENTS_PAGE_SIZE);
      setLoading(false);
    })();
  }, [fetchComments]);

  const loadedThreadCount = comments.filter((c) => !c.parentId).length;

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchComments(loadedThreadCount + COMMENTS_PAGE_SIZE);
    setLoadingMore(false);
  };

  const postComment = async (content: string, parentId?: string, format: string = "markdown") => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId, contentFormat: format }),
    });
    if (res.ok) await fetchComments(Math.max(loadedThreadCount, COMMENTS_PAGE_SIZE));
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`${endpoint}/${commentId}`, { method: "DELETE" });
      if (res.ok) await fetchComments(Math.max(loadedThreadCount, COMMENTS_PAGE_SIZE));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    if (isPlainTheme) return <p>{tCommon("loading")}</p>;
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  if (isPlainTheme) {
    return (
      <PlainProjectComments
        comments={comments}
        isLoggedIn={isLoggedIn}
        currentUserId={currentUserId}
        onDelete={handleDelete}
        onPost={(content, parentId) => postComment(content, parentId)}
      />
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      {isLoggedIn ? (
        <CommentForm
          title={t("titleWithCount", { count: totalThreads })}
          placeholder={t("projectPlaceholder")}
          submitLabel={t("submit")}
          initialFormat={defaultCommentBodyFormat}
          onSubmit={async (content, format) => {
            await postComment(content, undefined, format);
          }}
        />
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {t("titleWithCount", { count: totalThreads })}
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

      {loadedThreadCount < totalThreads && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Button variant="outlined" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <CircularProgress size={20} /> : t("loadMore")}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ProjectComments;
