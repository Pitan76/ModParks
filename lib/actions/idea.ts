"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { ideas, ideaLikes, ideaComments } from "@/db/schema";
import { createIdeaSchema, createIdeaCommentSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyToUser, resolveActorName } from "@/lib/notifications/notify";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import {
  getIdeaTarget,
  revalidateIdea,
  canManageIdea,
  loadManageableIdea,
  resolveCommentParent,
} from "./ideaShared";

// ---- アイデア作成 ----

export async function createIdea(formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    title:      formData.get("title"),
    content:    formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    visibility: formData.get("visibility"),
  };

  const parsed = createIdeaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { title, content, contentFormat, visibility } = parsed.data;
  const id = createId();

  try {
    await db.insert(ideas).values({
      id,
      title,
      content,
      contentFormat,
      authorId: userId,
      status: "open",
      visibility: visibility || "public",
    });
    
    revalidatePath("/ideas");
    return { success: true, id };
  } catch (error: any) {
    console.error("Failed to create idea:", error);
    return { error: { server: [(await getServerErrors())("idea.createFailed")] } };
  }
}

// ---- アイデア編集 ----

/**
 * アイデアを編集する。投稿者本人または管理者のみ許可。
 */
export async function updateIdea(ideaId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const loaded = await loadManageableIdea(db, ideaId, userId, "idea.noEditPermission");
  if (loaded.error) return { error: { server: [loaded.error] } };

  const raw = {
    title:      formData.get("title"),
    content:    formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    visibility: formData.get("visibility"),
  };

  const parsed = createIdeaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { title, content, contentFormat, visibility } = parsed.data;

  await db.update(ideas)
    .set({ title, content, contentFormat, visibility: visibility || "public" })
    .where(eq(ideas.id, ideaId))
    .run();

  revalidateIdea(ideaId);
  return { success: true };
}

// ---- ステータス変更 ----

/**
 * アイデアのステータスを変更する。投稿者本人または管理者のみ許可。
 */
export async function updateIdeaStatus(ideaId: string, status: "open" | "in_progress" | "fulfilled") {
  const { db, userId } = await getAuthenticatedDb();

  const loaded = await loadManageableIdea(db, ideaId, userId, "idea.noStatusPermission");
  if (loaded.error) return { error: { server: [loaded.error] } };

  if (!["open", "in_progress", "fulfilled"].includes(status)) {
    return { error: { server: [(await getServerErrors())("idea.invalidStatus")] } };
  }

  await db.update(ideas)
    .set({ status })
    .where(eq(ideas.id, ideaId))
    .run();

  revalidateIdea(ideaId);
  return { success: true };
}

// ---- アイデア削除 ----

/**
 * アイデアを削除する。投稿者本人または管理者のみ許可。
 */
export async function deleteIdea(ideaId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const loaded = await loadManageableIdea(db, ideaId, userId, "idea.noDeletePermission");
  if (loaded.error) return { error: loaded.error };

  await db.delete(ideas).where(eq(ideas.id, ideaId)).run();
  await recordDeletion(db, "ideas", ideaId);

  revalidatePath("/ideas");
  return { success: true };
}

// ---- いいねのトグル ----

export async function toggleIdeaLike(ideaId: string) {
  const { db, userId } = await getAuthenticatedDb();

  try {
    const existing = await db
      .select()
      .from(ideaLikes)
      .where(and(eq(ideaLikes.ideaId, ideaId), eq(ideaLikes.userId, userId)))
      .get();

    if (existing) {
      await db.delete(ideaLikes).where(and(eq(ideaLikes.ideaId, ideaId), eq(ideaLikes.userId, userId)));
      await recordDeletion(db, "idea_likes", buildRecordKey(ideaId, userId));
    } else {
      await db.insert(ideaLikes).values({ ideaId, userId });
      const idea = await getIdeaTarget(db, ideaId);
      if (idea) {
        await notifyToUser(db, idea.authorId, userId, "idea_like", {
          ideaId,
          ideaTitle: idea.title,
          actorName: await resolveActorName(db, userId),
        });
      }
    }

    revalidatePath("/ideas");
    revalidatePath(`/ideas/${ideaId}`);
    return { success: true, liked: !existing };
  } catch (error) {
    console.error("Failed to toggle like:", error);
    return { success: false, error: (await getServerErrors())("idea.likeFailed") };
  }
}

// ---- コメント作成 ----

export async function createIdeaComment(ideaId: string, formData: FormData) {
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

    await db.insert(ideaComments).values({
      id,
      ideaId,
      content,
      contentFormat,
      authorId: userId,
      parentId,
    });

    const idea = await getIdeaTarget(db, ideaId);
    if (idea) {
      const actorName = await resolveActorName(db, userId);
      if (parentAuthorId) {
        await notifyToUser(db, parentAuthorId, userId, "comment_reply", { ideaId, ideaTitle: idea.title, actorName });
      } else {
        await notifyToUser(db, idea.authorId, userId, "idea_comment", { ideaId, ideaTitle: idea.title, actorName });
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
  const comment = await db.select().from(ideaComments).where(eq(ideaComments.id, commentId)).get();
  if (!comment) return { error: { server: [t("idea.commentNotFound")] } };
  if (comment.authorId !== userId) return { error: { server: [t("idea.noEditPermission")] } };

  await db.update(ideaComments)
    .set({ content: parsed.data.content, contentFormat: parsed.data.contentFormat, updatedAt: new Date() })
    .where(eq(ideaComments.id, commentId))
    .run();

  revalidatePath(`/ideas/${comment.ideaId}`);
  return { success: true };
}

// ---- コメント削除 ----

/** アイデアコメントを削除する。投稿者本人または管理者のみ許可。 */
export async function deleteIdeaComment(commentId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const t = await getServerErrors();
  const comment = await db.select().from(ideaComments).where(eq(ideaComments.id, commentId)).get();
  if (!comment) return { error: t("idea.commentNotFound") };

  // 削除はコメント投稿者本人・管理者に加え、アイデア所有者によるモデレーションも許可
  let allowed = await canManageIdea(db, comment.authorId, userId);
  if (!allowed) {
    const idea = await db.select({ authorId: ideas.authorId }).from(ideas).where(eq(ideas.id, comment.ideaId)).get();
    allowed = idea?.authorId === userId;
  }
  if (!allowed) return { error: t("idea.noDeletePermission") };

  await db.delete(ideaComments).where(eq(ideaComments.id, commentId)).run();
  await recordDeletion(db, "idea_comments", commentId);

  revalidatePath(`/ideas/${comment.ideaId}`);
  return { success: true };
}
