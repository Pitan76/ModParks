"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { ideas, ideaLikes, ideaComments } from "@/db/schema";
import { createIdeaSchema, createIdeaCommentSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    } else {
      await db.insert(ideaLikes).values({ ideaId, userId });
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

  try {
    await db.insert(ideaComments).values({
      id,
      ideaId,
      content,
      authorId: userId,
    });

    revalidatePath(`/ideas/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return { error: { server: ["コメントの投稿に失敗しました"] } };
  }
}
