"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { userNotifyContext } from "@/lib/notifications/notify";
import { assertFeatureEnabled } from "@/lib/runtime/guard";
import * as core from "@modparks/core/ideas/comments";

/**
 * idea のコメントの Server Action。本体は core/ideas/comments.ts にあり、画面は
 * modparks-api から同じ本体を呼んでいる。ここは互換のために残している薄いラッパで、
 * 認証・機能停止の判定・キャッシュの無効化だけを担う。
 */

async function deps() {
  const { db, userId } = await getAuthenticatedDb();

  return { deps: { notify: await userNotifyContext(db), t: await getServerErrors() }, userId };
}

export async function createIdeaComment(ideaId: string, formData: FormData) {
  await assertFeatureEnabled("comment");

  const { deps: d, userId } = await deps();
  const result = await core.createIdeaComment(d, userId, ideaId, formData);
  if ("success" in result) revalidatePath(`/ideas/${ideaId}`);

  return result;
}

/** アイデアコメントを編集する。投稿者本人のみ許可 */
export async function updateIdeaComment(commentId: string, formData: FormData) {
  const { deps: d, userId } = await deps();
  const result = await core.updateIdeaComment(d, userId, commentId, formData);
  if ("success" in result) revalidatePath(`/ideas/${result.postId}`);

  return result;
}

/** アイデアコメントを削除する。投稿者本人・管理者・アイデア所有者のみ許可 */
export async function deleteIdeaComment(commentId: string) {
  const { deps: d, userId } = await deps();
  const result = await core.deleteIdeaComment(d, userId, commentId);
  if ("success" in result) revalidatePath(`/ideas/${result.postId}`);

  return result;
}
