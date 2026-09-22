import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { comments, posts } from "@modparks/core/db/schema";
import { createIdeaCommentSchema } from "@modparks/core/validations";
import { recordDeletion } from "@modparks/core/backup/tombstone";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import { notifyToUser, resolveActor, type UserNotifyContext } from "@modparks/core/notifications/dispatch";
import { canManageIdea, getIdeaTarget, resolveCommentParent } from "@modparks/core/ideas/shared";

/**
 * idea のコメントの作成・編集・削除の本体。
 *
 * 戻り値は移設前の Server Action と同じ形。編集・削除は成功時に postId も返す
 * （Next 側がどのページを無効化するかを知るため。画面側は使わない）。
 * 機能停止の判定（comment）はここでは行わず、入口で行う。
 */
export type CommentDeps = { notify: UserNotifyContext; t: ServerErrorTranslator };

function readCommentFields(formData: FormData) {
  return createIdeaCommentSchema.safeParse({ content: formData.get("content"), contentFormat: formData.get("contentFormat") });
}

/** 作成。返信なら親コメントの投稿者へ、そうでなければ idea の作者へ通知する */
export async function createIdeaComment({ notify, t }: CommentDeps, userId: string, ideaId: string, formData: FormData) {
  const parsed = readCommentFields(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { db } = notify;
  const { content, contentFormat } = parsed.data;

  // DB は外部I/O境界。失敗は表示用の文言にして返す（移設前と同じ）
  try {
    const { parentId, parentAuthorId } = await resolveCommentParent(db, ideaId, formData.get("parentId") as string | null);
    await db.insert(comments).values({ id: createId(), postId: ideaId, content, contentFormat, authorId: userId, parentId });

    const idea = await getIdeaTarget(db, ideaId);
    if (idea) {
      const payload = { kind: "idea" as const, slug: idea.slug, title: idea.title, ...(await resolveActor(db, userId)) };
      if (parentAuthorId) await notifyToUser(notify, parentAuthorId, userId, "comment_reply", payload);
      else await notifyToUser(notify, idea.authorId, userId, "comment", payload);
    }

    return { success: true as const };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return { error: { server: [t("idea.commentCreateFailed")] } };
  }
}

/** 編集。投稿者本人のみ許可 */
export async function updateIdeaComment({ notify, t }: CommentDeps, userId: string, commentId: string, formData: FormData) {
  const parsed = readCommentFields(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { db } = notify;
  const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!comment) return { error: { server: [t("idea.commentNotFound")] } };
  if (comment.authorId !== userId) return { error: { server: [t("idea.noEditPermission")] } };

  await db.update(comments)
    .set({ content: parsed.data.content, contentFormat: parsed.data.contentFormat, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .run();

  return { success: true as const, postId: comment.postId };
}

/**
 * 削除。コメント投稿者本人・管理者に加え、idea 所有者によるモデレーションも許可。
 * 失敗時の error は文字列（移設前の形）。
 */
export async function deleteIdeaComment({ notify, t }: CommentDeps, userId: string, commentId: string) {
  const { db } = notify;
  const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!comment) return { error: t("idea.commentNotFound") };

  let allowed = await canManageIdea(db, comment.authorId, userId);
  if (!allowed) {
    const idea = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, comment.postId)).get();
    allowed = idea?.authorId === userId;
  }
  if (!allowed) return { error: t("idea.noDeletePermission") };

  await db.delete(comments).where(eq(comments.id, commentId)).run();
  await recordDeletion(db, "comments", commentId);

  return { success: true as const, postId: comment.postId };
}
