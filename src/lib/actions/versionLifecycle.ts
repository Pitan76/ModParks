"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { versions, projectDependencies } from "@/db/schema";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getR2Bucket, deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { recordDeletion } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { ProjectPost } from "@/types/post";

/**
 * バージョン単体を操作する Server Action の共通前処理。
 *
 * プロジェクト解決 → 編集権限 → バージョン解決 → 所属確認 を 1 つにまとめる。
 * 個別に書くと所属確認の抜けが他プロジェクトのバージョンへの操作を許してしまうため、
 * ここに集約して同じ順序で必ず通す。
 *
 * @returns 失敗時は表示用エラー、成功時は接続・プロジェクト・バージョン
 */
type ManageableVersion =
  | { error: string }
  | { error?: undefined; db: Database; project: ProjectPost; version: typeof versions.$inferSelect };

async function loadManageableVersion(versionId: string, projectSlug: string): Promise<ManageableVersion> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: t("project.notFound") };

  try {
    await assertProjectAccess(db, project, session);
  } catch {
    return { error: t("common.forbidden") };
  }

  const version = await db.select().from(versions).where(eq(versions.id, versionId)).get();
  if (!version) return { error: t("version.notFound") };
  if (version.projectId !== project.id) return { error: t("version.notInProject") };

  return { db, project, version };
}

/**
 * プロジェクトのバージョン（ファイル）を削除する Server Action。
 */
export const deleteVersion = async (versionId: string, projectSlug: string): Promise<ActionResult> => {
  const loaded = await loadManageableVersion(versionId, projectSlug);
  if (loaded.error !== undefined) return { error: loaded.error };
  const { db, version } = loaded;

  const r2Key = getR2KeyFromUrl(version.fileUrl);
  if (r2Key) {
    try {
      const bucket = await getR2Bucket();
      await deleteFromR2(bucket, r2Key);
    } catch (e) {
      console.error(`[deleteVersion] Failed to delete R2 object: ${r2Key}`, e);
    }
  }

  // バージョン限定の依存は外部キーで消えるが、バックアップ側は墓標が無いと残り続ける
  const scopedDeps = await db
    .select({ id: projectDependencies.id })
    .from(projectDependencies)
    .where(eq(projectDependencies.versionId, versionId))
    .all();

  if (scopedDeps.length > 0) {
    await db.delete(projectDependencies).where(eq(projectDependencies.versionId, versionId)).run();
    await recordDeletion(db, "project_dependencies", scopedDeps.map((d: { id: string }) => d.id));
  }

  await db.delete(versions).where(eq(versions.id, versionId)).run();
  await recordDeletion(db, "versions", versionId);

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};

/**
 * バージョンのアーカイブ状態を切り替える Server Action。
 */
export const setVersionArchived = async (
  versionId: string,
  projectSlug: string,
  archived: boolean,
): Promise<ActionResult> => {
  const loaded = await loadManageableVersion(versionId, projectSlug);
  if (loaded.error !== undefined) return { error: loaded.error };
  const { db } = loaded;

  await db
    .update(versions)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(versions.id, versionId))
    .run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};
