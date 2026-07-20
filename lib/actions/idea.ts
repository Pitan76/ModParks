"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { ideas, ideaLikes, ideaComments } from "@/db/schema";
import { createIdeaSchema, createIdeaCommentSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyToUser, resolveActorName } from "@/lib/notifications/notify";

/** アイデアの投稿者・タイトルを取得する（通知の宛先・表示用） */
async function getIdeaTarget(db: any, ideaId: string) {
  return db
    .select({ authorId: ideas.authorId, title: ideas.title })
    .from(ideas)
    .where(eq(ideas.id, ideaId))
    .get();
}

/** 返信先の正規化（1階層のみ）。親コメントIDと親投稿者IDを返す */
async function resolveCommentParent(db: any, ideaId: string, rawParentId: string | null) {
  if (!rawParentId) return { parentId: null as string | null, parentAuthorId: null as string | null };
  const parent = await db
    .select({ id: ideaComments.id, authorId: ideaComments.authorId, parentId: ideaComments.parentId })
    .from(ideaComments)
    .where(and(eq(ideaComments.id, rawParentId), eq(ideaComments.ideaId, ideaId)))
    .get();
  if (!parent) return { parentId: null, parentAuthorId: null };
  return { parentId: parent.parentId ?? parent.id, parentAuthorId: parent.authorId };
}

// ─── アイデア作成 ─────────────────────────────────────────────────────────────

export async function createIdea(formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    title:      formData.get("title"),
    content:    formData.get("content"),
    visibility: formData.get("visibility"),
  };

  const parsed = createIdeaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { title, content, visibility } = parsed.data;
  const id = createId();

  try {
    await db.insert(ideas).values({
      id,
      title,
      content,
      authorId: userId,
      status: "open",
      visibility: visibility || "public",
    });
    
    revalidatePath("/ideas");
    return { success: true, id };
  } catch (error: any) {
    console.error("Failed to create idea:", error);
    return { error: { server: ["アイデアの投稿に失敗しました"] } };
  }
}

// ─── アイデア編集 ─────────────────────────────────────────────────────────────

/**
 * アイデアを編集する。投稿者本人または管理者のみ許可。
 */
export async function updateIdea(ideaId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const idea = await db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
  if (!idea) return { error: { server: ["アイデアが見つかりません"] } };
  if (!(await canManageIdea(db, idea.authorId, userId))) {
    return { error: { server: ["編集する権限がありません"] } };
  }

  const raw = {
    title:      formData.get("title"),
    content:    formData.get("content"),
    visibility: formData.get("visibility"),
  };

  const parsed = createIdeaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { title, content, visibility } = parsed.data;

  await db.update(ideas)
    .set({ title, content, visibility: visibility || "public" })
    .where(eq(ideas.id, ideaId))
    .run();

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  return { success: true };
}

// ─── ステータス変更 ─────────────────────────────────────────────────────────────

/**
 * アイデアのステータスを変更する。投稿者本人または管理者のみ許可。
 */
export async function updateIdeaStatus(ideaId: string, status: "open" | "in_progress" | "fulfilled") {
  const { db, userId } = await getAuthenticatedDb();

  const idea = await db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
  if (!idea) return { error: { server: ["アイデアが見つかりません"] } };
  if (!(await canManageIdea(db, idea.authorId, userId))) {
    return { error: { server: ["ステータスを変更する権限がありません"] } };
  }

  if (!["open", "in_progress", "fulfilled"].includes(status)) {
    return { error: { server: ["無効なステータスです"] } };
  }

  await db.update(ideas)
    .set({ status })
    .where(eq(ideas.id, ideaId))
    .run();

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  return { success: true };
}

// ─── アイデア削除 ─────────────────────────────────────────────────────────────

/**
 * アイデアを削除する。投稿者本人または管理者のみ許可。
 */
export async function deleteIdea(ideaId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const idea = await db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
  if (!idea) return { error: "アイデアが見つかりません" };
  if (!(await canManageIdea(db, idea.authorId, userId))) {
    return { error: "削除する権限がありません" };
  }

  await db.delete(ideas).where(eq(ideas.id, ideaId)).run();
  await recordDeletion(db, "ideas", ideaId);

  revalidatePath("/ideas");
  return { success: true };
}

/** 投稿者本人か管理者かを判定する */
async function canManageIdea(db: any, authorId: string, userId: string): Promise<boolean> {
  if (authorId === userId) return true;
  const { users } = await import("@/db/schema");
  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  return dbUser?.role === "admin";
}

// ─── いいねのトグル ─────────────────────────────────────────────────────────

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
    return { success: false, error: "いいねの操作に失敗しました" };
  }
}

// ─── コメント作成 ─────────────────────────────────────────────────────────────

export async function createIdeaComment(ideaId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    content: formData.get("content"),
  };

  const parsed = createIdeaCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { content } = parsed.data;
  const id = createId();
  const rawParentId = formData.get("parentId") as string | null;

  try {
    const { parentId, parentAuthorId } = await resolveCommentParent(db, ideaId, rawParentId);

    await db.insert(ideaComments).values({
      id,
      ideaId,
      content,
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
    return { error: { server: ["コメントの投稿に失敗しました"] } };
  }
}

// ─── コメント編集 ─────────────────────────────────────────────────────────────

/** アイデアコメントを編集する。投稿者本人のみ許可。 */
export async function updateIdeaComment(commentId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const parsed = createIdeaCommentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const comment = await db.select().from(ideaComments).where(eq(ideaComments.id, commentId)).get();
  if (!comment) return { error: { server: ["コメントが見つかりません"] } };
  if (comment.authorId !== userId) return { error: { server: ["編集する権限がありません"] } };

  await db.update(ideaComments)
    .set({ content: parsed.data.content, updatedAt: new Date() })
    .where(eq(ideaComments.id, commentId))
    .run();

  revalidatePath(`/ideas/${comment.ideaId}`);
  return { success: true };
}

// ─── コメント削除 ─────────────────────────────────────────────────────────────

/** アイデアコメントを削除する。投稿者本人または管理者のみ許可。 */
export async function deleteIdeaComment(commentId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const comment = await db.select().from(ideaComments).where(eq(ideaComments.id, commentId)).get();
  if (!comment) return { error: "コメントが見つかりません" };

  // 削除はコメント投稿者本人・管理者に加え、アイデア所有者によるモデレーションも許可
  let allowed = await canManageIdea(db, comment.authorId, userId);
  if (!allowed) {
    const idea = await db.select({ authorId: ideas.authorId }).from(ideas).where(eq(ideas.id, comment.ideaId)).get();
    allowed = idea?.authorId === userId;
  }
  if (!allowed) return { error: "削除する権限がありません" };

  await db.delete(ideaComments).where(eq(ideaComments.id, commentId)).run();
  await recordDeletion(db, "idea_comments", commentId);

  revalidatePath(`/ideas/${comment.ideaId}`);
  return { success: true };
}
