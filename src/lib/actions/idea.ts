"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, ideas, ideaTags } from "@/db/schema";
import { togglePostFavorite } from "./favorite";
import { createIdeaSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { revalidateIdea, loadManageableIdea } from "./ideaShared";

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

  const tags = (formData.getAll("tags") as string[]).map((t) => t.trim()).filter(Boolean);
  const loaders = (formData.getAll("loaders") as string[]).map((t) => t.trim()).filter(Boolean);
  const mcVersions = (formData.getAll("mcVersions") as string[]).map((t) => t.trim()).filter(Boolean);

  try {
    const { userSettings } = await import("@/db/schema");
    const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
    const defaultVisibility = settingsRecord?.defaultIdeaStatus || "public";
    const defaultFormat = settingsRecord?.defaultIdeaBodyFormat || "markdown";

    // タグは任意なので、あるときだけ文を足す。
    // batch の第1要素が必ず埋まる形にして、タプル型のまま渡せるようにする
    const tagInserts = tags.length > 0
      ? [db.insert(ideaTags).values(tags.map((tag) => ({ ideaId: id, tag })))]
      : [];

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
      db.insert(ideas).values({
        id,
        status: "open",
        loaders: loaders.length > 0 ? JSON.stringify(loaders) : null,
        mcVersions: mcVersions.length > 0 ? JSON.stringify(mcVersions) : null,
      }),
      ...tagInserts,
    ]);

    revalidatePath("/ideas");
    return { success: true, id };
  } catch (error) {
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

  const tags = (formData.getAll("tags") as string[]).map((t) => t.trim()).filter(Boolean);
  const loaders = (formData.getAll("loaders") as string[]).map((t) => t.trim()).filter(Boolean);
  const mcVersions = (formData.getAll("mcVersions") as string[]).map((t) => t.trim()).filter(Boolean);

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

  await db.update(ideas)
    .set({
      loaders: loaders.length > 0 ? JSON.stringify(loaders) : null,
      mcVersions: mcVersions.length > 0 ? JSON.stringify(mcVersions) : null,
    })
    .where(eq(ideas.id, ideaId))
    .run();

  await db.delete(ideaTags).where(eq(ideaTags.ideaId, ideaId)).run();
  if (tags.length > 0) {
    await db.insert(ideaTags).values(tags.map((tag) => ({ ideaId, tag }))).run();
  }

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

export {
  createIdeaComment,
  updateIdeaComment,
  deleteIdeaComment,
} from "./ideaComment";
