"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projectMedia } from "@modparks/core/db/schema";
import { getR2Bucket } from "@/lib/r2";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as media from "@modparks/core/projects/media";

/**
 * プロジェクトの画像（Server Action）。変更系の本体は core/projects/media.ts。
 */

/** 成功したときだけ、そのプロジェクトのページを無効化する */
function revalidateOnSuccess<R extends { slug?: string }>(result: R) {
  if (result.slug) revalidatePath(`/projects/${result.slug}`);

  return result;
}

/** プロジェクトの画像一覧を表示順で取得する（公開ページ・管理画面共通） */
export async function getProjectMedia(projectId: string) {
  const { db } = await getAuthenticatedDb();
  return await db
    .select()
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId))
    .orderBy(asc(projectMedia.sortOrder))
    .all();
}

/** アップロード済み画像URLをプロジェクトに登録する */
export async function addProjectMedia(projectId: string, url: string, caption?: string) {
  const { db, session } = await getAuthenticatedDb();
  return revalidateOnSuccess(await media.addProjectMedia(db, session.user.id, projectId, url, caption));
}

/** 画像を削除し、R2 上の実体も消す */
export async function deleteProjectMedia(mediaId: string) {
  const { db, session } = await getAuthenticatedDb();
  const storage = { r2PublicUrl: process.env.R2_PUBLIC_URL, getBucket: getR2Bucket };

  return revalidateOnSuccess(await media.deleteProjectMedia(db, storage, session.user.id, mediaId));
}

/** カルーセル掲載のオン/オフを切り替える */
export async function toggleMediaFeatured(mediaId: string, featured: boolean) {
  const { db, session } = await getAuthenticatedDb();
  return revalidateOnSuccess(await media.toggleMediaFeatured(db, session.user.id, mediaId, featured));
}

/** 画像の並び順を更新する（渡された順に 0..n を振り直す） */
export async function reorderProjectMedia(projectId: string, orderedIds: string[]) {
  const { db, session } = await getAuthenticatedDb();
  return revalidateOnSuccess(await media.reorderProjectMedia(db, session.user.id, projectId, orderedIds));
}
