"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import * as core from "@modparks/core/ideas/ideas";
import { togglePostFavorite } from "./favorite";

/**
 * idea の Server Action。本体は core/ideas/ideas.ts にあり、画面は modparks-api の
 * /api/app/ideas/* から同じ本体を呼んでいる。ここは互換のために残している薄いラッパで、
 * 認証とキャッシュの無効化だけを担う。
 */

/** アイデア一覧と該当詳細ページのキャッシュを破棄する */
function revalidateIdea(ideaId: string) {
  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
}

async function deps() {
  const { db, userId } = await getAuthenticatedDb();

  return { deps: { db, t: await getServerErrors() }, userId };
}

export async function createIdea(formData: FormData) {
  const { deps: d, userId } = await deps();
  const result = await core.createIdea(d, userId, formData);
  if ("success" in result) revalidatePath("/ideas");

  return result;
}

/** アイデアを編集する。投稿者本人または管理者のみ許可 */
export async function updateIdea(ideaId: string, formData: FormData) {
  const { deps: d, userId } = await deps();
  const result = await core.updateIdea(d, userId, ideaId, formData);
  if ("success" in result) revalidateIdea(ideaId);

  return result;
}

/** アイデアのステータスを変更する。投稿者本人または管理者のみ許可 */
export async function updateIdeaStatus(ideaId: string, status: "open" | "in_progress" | "fulfilled") {
  const { deps: d, userId } = await deps();
  const result = await core.updateIdeaStatus(d, userId, ideaId, status);
  if ("success" in result) revalidateIdea(ideaId);

  return result;
}

/** アイデアを削除する。投稿者本人または管理者のみ許可 */
export async function deleteIdea(ideaId: string) {
  const { deps: d, userId } = await deps();
  const result = await core.deleteIdea(d, userId, ideaId);
  if ("success" in result) revalidatePath("/ideas");

  return result;
}

/**
 * 旧 toggleIdeaLike。「いいね」と「お気に入り」は統合されたため、
 * Project と共通の togglePostFavorite に委譲する。
 */
export async function toggleIdeaFavorite(ideaId: string) {
  return togglePostFavorite(ideaId);
}

// コメント系のアクションは ./ideaComment に分けている。
// "use server" ファイルは値の再エクスポートができないため、呼び出し側はそちらを直接 import する。
