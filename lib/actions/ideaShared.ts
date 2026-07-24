import { ideas, ideaComments, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";

/** アイデアの投稿者・タイトルを取得する（通知の宛先・表示用） */
export async function getIdeaTarget(db: any, ideaId: string) {
  return db.select({ authorId: ideas.authorId, title: ideas.title }).from(ideas).where(eq(ideas.id, ideaId)).get();
}

/** アイデア一覧と該当詳細ページのキャッシュを破棄する */
export const revalidateIdea = (ideaId: string) => {
  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
};

/** 投稿者本人か管理者かを判定する */
export async function canManageIdea(db: any, authorId: string, userId: string): Promise<boolean> {
  if (authorId === userId) return true;
  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  return dbUser?.role === "admin";
}

/**
 * アイデアを取得し、操作者が管理権限を持つかを検証する。
 * 失敗時は表示用エラーメッセージ、成功時はアイデア本体を返す。
 */
export async function loadManageableIdea(db: any, ideaId: string, userId: string, deniedKey: string) {
  const t = await getServerErrors();
  const idea = await db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
  if (!idea) return { error: t("idea.notFound") };
  if (!(await canManageIdea(db, idea.authorId, userId))) return { error: t(deniedKey) };
  return { idea };
}

/** 返信先の正規化（1階層のみ）。親コメントIDと親投稿者IDを返す */
export async function resolveCommentParent(db: any, ideaId: string, rawParentId: string | null) {
  if (!rawParentId) return { parentId: null as string | null, parentAuthorId: null as string | null };
  const parent = await db
    .select({ id: ideaComments.id, authorId: ideaComments.authorId, parentId: ideaComments.parentId })
    .from(ideaComments)
    .where(and(eq(ideaComments.id, rawParentId), eq(ideaComments.ideaId, ideaId)))
    .get();
  if (!parent) return { parentId: null, parentAuthorId: null };
  return { parentId: parent.parentId ?? parent.id, parentAuthorId: parent.authorId };
}
