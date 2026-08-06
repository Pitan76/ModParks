"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Comment } from "@/components/project/ProjectCommentItem";
import styles from "../plain.module.css";

export type PlainProjectCommentsProps = {
  comments: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onPost: (content: string, parentId?: string) => Promise<void>;
};

type CommentEntryProps = {
  comment: Comment;
  replies: Comment[];
  isLoggedIn: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onPost: (content: string, parentId?: string) => Promise<void>;
};

/** 投稿フォーム。textarea 1つと送信ボタンのみで構成する */
const CommentBox = ({
  label,
  parentId,
  onPost,
}: {
  label: string;
  parentId?: string;
  onPost: (content: string, parentId?: string) => Promise<void>;
}) => {
  const [content, setContent] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;
    await onPost(content, parentId);
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className={styles.commentForm}>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
      <button type="submit">{label}</button>
    </form>
  );
};

/** 1件のコメントと、その返信一覧・返信フォームを表示する */
const CommentEntry = ({ comment, replies, isLoggedIn, currentUserId, onDelete, onPost }: CommentEntryProps) => {
  const t = useTranslations("Comment");

  return (
    <li>
      <p className={styles.commentMeta}>
        <strong>{comment.authorName}</strong>{" "}
        <time dateTime={comment.createdAt} className={styles.dim}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
        {currentUserId === comment.authorId && (
          <button type="button" onClick={() => onDelete(comment.id)}>{t("delete")}</button>
        )}
      </p>
      <p className={styles.commentBody}>{comment.content}</p>

      {replies.length > 0 && (
        <ul className={styles.plainList}>
          {replies.map((reply) => (
            <CommentEntry
              key={reply.id}
              comment={reply}
              replies={[]}
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onPost={onPost}
            />
          ))}
        </ul>
      )}

      {isLoggedIn && (
        <details>
          <summary>{t("reply")}</summary>
          <CommentBox label={t("submit")} parentId={comment.id} onPost={onPost} />
        </details>
      )}
    </li>
  );
};

/**
 * Plain Theme 用のコメント一覧。
 * Markdown整形やアバターを持たず、標準の list / textarea / details のみで構成する。
 */
const PlainProjectComments = ({ comments, isLoggedIn, currentUserId, onDelete, onPost }: PlainProjectCommentsProps) => {
  const t = useTranslations("Comment");
  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <section>
      <h2>{t("titleWithCount", { count: comments.length })}</h2>

      {isLoggedIn ? <CommentBox label={t("submit")} onPost={onPost} /> : <p className={styles.dim}>{t("loginPrompt")}</p>}

      {topLevel.length === 0 ? (
        <p className={styles.dim}>{t("empty")}</p>
      ) : (
        <ul className={styles.plainList}>
          {topLevel.map((comment) => (
            <CommentEntry
              key={comment.id}
              comment={comment}
              replies={comments.filter((c) => c.parentId === comment.id)}
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onPost={onPost}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default PlainProjectComments;
