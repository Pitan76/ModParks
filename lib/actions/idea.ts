"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, ideas, comments } from "@/db/schema";
import { togglePostFavorite } from "./favorite";
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
    const { userSettings } = await import("@/db/schema");
    const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
    const defaultVisibility = settingsRecord?.defaultIdeaStatus || "public";
    const defaultFormat = (settingsRecord?.defaultIdeaBodyFormat as any) || "markdown";

    // Idea の slug は作成時点では id と同じランダム値。作者が後から変更できる。
    await db.batch([
      db.insert(posts).values({
        id,
        authorId:   userId,
        kind:       "idea",
        slug:       id,
        title,
        body:       content,
        bodyFormat: contentFormat || defaultFormat,
        visibility: visibility || defaultVisibility,
      }),
      db.insert(ideas).values({ id, status: "open" }),
    ]);

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

  // タイトル・本文・公開範囲はすべて posts 側にある
  await db.update(posts)
    .set({
      title,
      body: content,
      bodyFormat: contentFormat,
      visibility: visibility || "public",
      updatedAt: new Date(),
    })
    .where(eq(posts.id, ideaId))
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

  await db.batch([
    db.update(ideas).set({ status }).where(eq(ideas.id, ideaId)),
    db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, ideaId)),
  ]);

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

  // posts を削除すると ideas / comments / favorites は cascade で消える
  await db.delete(posts).where(eq(posts.id, ideaId)).run();
  await recordDeletion(db, "posts", ideaId);

  revalidatePath("/ideas");
  return { success: true };
}

// ---- お気に入りのトグル ----

/**
 * 旧 toggleIdeaLike。「いいね」と「お気に入り」は統合されたため、
 * Project と共通の togglePostFavorite に委譲する。
 */
export async function toggleIdeaFavorite(ideaId: string) {
  return togglePostFavorite(ideaId);
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
      const actorName = await resolveActorName(db, userId);
      if (parentAuthorId) {
        await notifyToUser(db, parentAuthorId, userId, "comment_reply", {
          kind: "idea", slug: idea.slug, title: idea.title, actorName,
        });
      } else {
        await notifyToUser(db, idea.authorId, userId, "comment", {
          kind: "idea", slug: idea.slug, title: idea.title, actorName,
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
