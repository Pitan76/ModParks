"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, comments } from "@/db/schema";
import { createIdeaCommentSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyToUser, resolveActor } from "@/lib/notifications/notify";
import { recordDeletion } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { getIdeaTarget, canManageIdea, resolveCommentParent } from "./ideaShared";
import { assertFeatureEnabled } from "@/lib/runtime/guard";

// ---- コメント作成 ----

export async function createIdeaComment(ideaId: string, formData: FormData) {
  await assertFeatureEnabled("comment");

  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
  };

  const parsed = createIdeaCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { content, contentFormat } = parsed.data;
  const id = createId();
  const rawParentId = formData.get("parentId") as string | null;

  try {
    const { parentId, parentAuthorId } = await resolveCommentParent(db, ideaId, rawParentId);

    await db.insert(comments).values({
      id,
      postId: ideaId,
      content,
      contentFormat,
      authorId: userId,
      parentId,
    });

    const idea = await getIdeaTarget(db, ideaId);
    if (idea) {
      const actor = await resolveActor(db, userId);
      if (parentAuthorId) {
        await notifyToUser(db, parentAuthorId, userId, "comment_reply", {
          kind: "idea", slug: idea.slug, title: idea.title, ...actor,
        });
      } else {
        await notifyToUser(db, idea.authorId, userId, "comment", {
          kind: "idea", slug: idea.slug, title: idea.title, ...actor,
        });
      }
    }

    revalidatePath(`/ideas/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return { error: { server: [(await getServerErrors())("idea.commentCreateFailed")] } };
  }
}

// ---- コメント編集 ----

/** アイデアコメントを編集する。投稿者本人のみ許可。 */
export async function updateIdeaComment(commentId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
  };
  const parsed = createIdeaCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const t = await getServerErrors();
  const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!comment) return { error: { server: [t("idea.commentNotFound")] } };
  if (comment.authorId !== userId) return { error: { server: [t("idea.noEditPermission")] } };

  await db.update(comments)
    .set({ content: parsed.data.content, contentFormat: parsed.data.contentFormat, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .run();

  revalidatePath(`/ideas/${comment.postId}`);
  return { success: true };
}

// ---- コメント削除 ----

/** アイデアコメントを削除する。投稿者本人または管理者のみ許可。 */
export async function deleteIdeaComment(commentId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const t = await getServerErrors();
  const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!comment) return { error: t("idea.commentNotFound") };

  // 削除はコメント投稿者本人・管理者に加え、アイデア所有者によるモデレーションも許可
  let allowed = await canManageIdea(db, comment.authorId, userId);
  if (!allowed) {
    const idea = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, comment.postId)).get();
    allowed = idea?.authorId === userId;
  }
  if (!allowed) return { error: t("idea.noDeletePermission") };

  await db.delete(comments).where(eq(comments.id, commentId)).run();
  await recordDeletion(db, "comments", commentId);

  revalidatePath(`/ideas/${comment.postId}`);
  return { success: true };
}
