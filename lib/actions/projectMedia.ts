"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { projectMedia, projects } from "@/db/schema";
import { getR2Bucket, deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { recordDeletion } from "@/lib/backup/tombstone";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** 1プロジェクトあたりの画像上限。無料枠の容量を守るための歯止め */
const MAX_MEDIA_PER_PROJECT = 12;

async function assertMediaAccess(db: any, projectId: string, session: any) {
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Project not found");
  await assertProjectAccess(db, project, session);
  return project;
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
  const project = await assertMediaAccess(db, projectId, session);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId))
    .get();
  if ((countRes?.count ?? 0) >= MAX_MEDIA_PER_PROJECT) {
    return { error: "limitReached" };
  }

  await db.insert(projectMedia).values({
    id: createId(),
    projectId,
    url,
    caption: caption?.trim() || null,
    sortOrder: countRes?.count ?? 0,
  }).run();

  revalidatePath(`/projects/${project.slug}`);
  return { success: true };
}

/** 画像を削除し、R2 上の実体も消す */
export async function deleteProjectMedia(mediaId: string) {
  const { db, session } = await getAuthenticatedDb();

  const media = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).get();
  if (!media) return { error: "notFound" };
  const project = await assertMediaAccess(db, media.projectId, session);

  const r2Key = getR2KeyFromUrl(media.url);
  if (r2Key) {
    try {
      await deleteFromR2(await getR2Bucket(), r2Key);
    } catch (e) {
      console.error("failed to delete media from R2:", e);
    }
  }

  await db.delete(projectMedia).where(eq(projectMedia.id, mediaId)).run();
  await recordDeletion(db, "project_media", mediaId);

  revalidatePath(`/projects/${project.slug}`);
  return { success: true };
}

/** カルーセル掲載のオン/オフを切り替える */
export async function toggleMediaFeatured(mediaId: string, featured: boolean) {
  const { db, session } = await getAuthenticatedDb();

  const media = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).get();
  if (!media) return { error: "notFound" };
  const project = await assertMediaAccess(db, media.projectId, session);

  await db.update(projectMedia).set({ featured }).where(eq(projectMedia.id, mediaId)).run();

  revalidatePath(`/projects/${project.slug}`);
  return { success: true };
}

/** 画像の並び順を更新する（渡された順に 0..n を振り直す） */
export async function reorderProjectMedia(projectId: string, orderedIds: string[]) {
  const { db, session } = await getAuthenticatedDb();
  const project = await assertMediaAccess(db, projectId, session);

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(projectMedia)
        .set({ sortOrder: index })
        .where(and(eq(projectMedia.id, id), eq(projectMedia.projectId, projectId)))
        .run()
    )
  );

  revalidatePath(`/projects/${project.slug}`);
  return { success: true };
}
