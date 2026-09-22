import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "@modparks/core/db/client";
import { projectMedia } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { deleteFromR2, r2KeyFromUrl } from "@modparks/core/r2";
import { recordDeletion } from "@modparks/core/backup/tombstone";

/**
 * プロジェクトの画像（ギャラリー）の追加・削除・掲載切り替え・並べ替えの本体。
 * Next の Server Action と modparks-api の両方から呼ぶ。戻り値の slug はキャッシュを
 * 無効化する呼び出し側のためのもの。
 */

/** 1プロジェクトあたりの画像上限。無料枠の容量を守るための歯止め */
const MAX_MEDIA_PER_PROJECT = 12;

export type MediaStorage = {
  r2PublicUrl: string | undefined;
  /** R2 上の画像を消すときだけ解決する */
  getBucket: () => Promise<R2Bucket>;
};

/** 見つからない・権限なしは移設前と同じく例外で伝える */
async function loadEditableProject(db: Database, projectId: string, userId: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");
  if (!(await canEditProject(db, project, userId))) throw new Error("Forbidden");

  return project;
}

/** 画像と、それが属する編集可能なプロジェクトを取る */
async function loadEditableMedia(db: Database, mediaId: string, userId: string) {
  const media = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).get();
  if (!media) return null;

  return { media, project: await loadEditableProject(db, media.projectId, userId) };
}

/** アップロード済み画像URLをプロジェクトに登録する */
export async function addProjectMedia(db: Database, userId: string, projectId: string, url: string, caption?: string) {
  const project = await loadEditableProject(db, projectId, userId);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId))
    .get();
  const count = countRes?.count ?? 0;
  if (count >= MAX_MEDIA_PER_PROJECT) return { error: "limitReached" };

  await db.insert(projectMedia).values({
    id: createId(),
    projectId,
    url,
    caption: caption?.trim() || null,
    sortOrder: count,
  }).run();

  return { success: true as const, slug: project.slug };
}

/** 画像を削除し、R2 上の実体も消す */
export async function deleteProjectMedia(db: Database, storage: MediaStorage, userId: string, mediaId: string) {
  const loaded = await loadEditableMedia(db, mediaId, userId);
  if (!loaded) return { error: "notFound" };

  const r2Key = r2KeyFromUrl(storage.r2PublicUrl, loaded.media.url);
  // R2 は外部I/O境界。実体を消し損ねても登録は外す（一覧に残り続ける方が困る）
  if (r2Key) {
    try {
      await deleteFromR2(await storage.getBucket(), r2Key);
    } catch (e) {
      console.error("failed to delete media from R2:", e);
    }
  }

  await db.delete(projectMedia).where(eq(projectMedia.id, mediaId)).run();
  await recordDeletion(db, "project_media", mediaId);

  return { success: true as const, slug: loaded.project.slug };
}

/** カルーセル掲載のオン/オフを切り替える */
export async function toggleMediaFeatured(db: Database, userId: string, mediaId: string, featured: boolean) {
  const loaded = await loadEditableMedia(db, mediaId, userId);
  if (!loaded) return { error: "notFound" };

  await db.update(projectMedia).set({ featured }).where(eq(projectMedia.id, mediaId)).run();

  return { success: true as const, slug: loaded.project.slug };
}

/** 画像の並び順を更新する（渡された順に 0..n を振り直す） */
export async function reorderProjectMedia(db: Database, userId: string, projectId: string, orderedIds: string[]) {
  const project = await loadEditableProject(db, projectId, userId);

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(projectMedia)
        .set({ sortOrder: index })
        .where(and(eq(projectMedia.id, id), eq(projectMedia.projectId, projectId)))
        .run()
    )
  );

  return { success: true as const, slug: project.slug };
}
