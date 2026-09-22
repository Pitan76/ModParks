import { and, eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { comments, posts } from "@modparks/core/db/schema";
import { isAdminUser } from "@modparks/core/auth/roles";
import { findIdeaPostById } from "@modparks/core/queries/post";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * idea の操作で共通に使う問い合わせ。
 *
 * エラー文言の翻訳関数は環境から作るものなので受け取る（Next は next-intl、
 * modparks-api は lang/*.json の ServerErrors）。キャッシュの無効化はここでは行わない。
 */

/** アイデアの投稿者・タイトルを取得する（通知の宛先・表示用） */
export async function getIdeaTarget(db: Database, ideaId: string) {
  return db
    .select({ authorId: posts.authorId, title: posts.title, slug: posts.slug })
    .from(posts)
    .where(eq(posts.id, ideaId))
    .get();
}

/** 投稿者本人か管理者かを判定する */
export async function canManageIdea(db: Database, authorId: string, userId: string): Promise<boolean> {
  if (authorId === userId) return true;

  return isAdminUser(db, userId);
}

/**
 * アイデアを取得し、操作者が管理権限を持つかを検証する。
 * 失敗時は表示用エラーメッセージ、成功時はアイデア本体を返す。
 */
export async function loadManageableIdea(db: Database, t: ServerErrorTranslator, ideaId: string, userId: string, deniedKey: string) {
  const idea = await findIdeaPostById(db, ideaId);
  if (!idea) return { error: t("idea.notFound") };
  if (!(await canManageIdea(db, idea.authorId, userId))) return { error: t(deniedKey) };

  return { idea };
}

/** 返信先の正規化（1階層のみ）。親コメントIDと親投稿者IDを返す */
export async function resolveCommentParent(db: Database, ideaId: string, rawParentId: string | null) {
  if (!rawParentId) return { parentId: null as string | null, parentAuthorId: null as string | null };

  const parent = await db
    .select({ id: comments.id, authorId: comments.authorId, parentId: comments.parentId })
    .from(comments)
    .where(and(eq(comments.id, rawParentId), eq(comments.postId, ideaId)))
    .get();
  if (!parent) return { parentId: null, parentAuthorId: null };

  return { parentId: parent.parentId ?? parent.id, parentAuthorId: parent.authorId };
}

/** FormData の複数値を、空白を落として配列にする */
export function formList(formData: FormData, name: string): string[] {
  return (formData.getAll(name) as string[]).map((v) => v.trim()).filter(Boolean);
}
