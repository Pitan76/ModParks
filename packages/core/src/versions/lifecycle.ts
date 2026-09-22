import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { versions, projectDependencies } from "@modparks/core/db/schema";
import { findProjectPostBySlug } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { deleteFromR2, r2KeyFromUrl } from "@modparks/core/r2";
import { recordDeletion } from "@modparks/core/backup/tombstone";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import type { ActionResult } from "@modparks/core/actionResult";

/**
 * バージョンの削除・アーカイブの本体。Next の Server Action と modparks-api の両方から呼ぶ。
 * キャッシュの無効化は呼び出し側で行う。
 */
export type VersionLifecycleDeps = {
  db: Database;
  t: ServerErrorTranslator;
  r2PublicUrl: string | undefined;
  /** 外部サイトのファイルなら R2 は触らないため、要るときだけ解決する */
  getBucket: () => Promise<R2Bucket>;
};

/**
 * プロジェクト解決 → 編集権限 → バージョン解決 → 所属確認 を 1 つにまとめる。
 * 個別に書くと所属確認の抜けが他プロジェクトのバージョンへの操作を許してしまうため、
 * ここに集約して同じ順序で必ず通す。
 *
 * @returns 失敗時は表示用エラー、成功時はバージョン
 */
async function loadManageableVersion({ db, t }: VersionLifecycleDeps, userId: string, versionId: string, projectSlug: string) {
  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: t("project.notFound") };
  if (!(await canEditProject(db, project, userId))) return { error: t("common.forbidden") };

  const version = await db.select().from(versions).where(eq(versions.id, versionId)).get();
  if (!version) return { error: t("version.notFound") };
  if (version.projectId !== project.id) return { error: t("version.notInProject") };

  return { version };
}

/** R2 は外部I/O境界。消し損ねてもバージョン削除自体は進める */
async function deleteVersionFile(deps: VersionLifecycleDeps, fileUrl: string) {
  const r2Key = r2KeyFromUrl(deps.r2PublicUrl, fileUrl);
  if (!r2Key) return;

  try {
    await deleteFromR2(await deps.getBucket(), r2Key);
  } catch (e) {
    console.error(`[deleteVersion] Failed to delete R2 object: ${r2Key}`, e);
  }
}

/** バージョン（ファイル）を削除する */
export async function deleteVersion(deps: VersionLifecycleDeps, userId: string, versionId: string, projectSlug: string): Promise<ActionResult> {
  const loaded = await loadManageableVersion(deps, userId, versionId, projectSlug);
  if (!loaded.version) return { error: loaded.error };
  const { db } = deps;

  await deleteVersionFile(deps, loaded.version.fileUrl);

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

  return { success: true };
}

/** バージョンのアーカイブ状態を切り替える */
export async function setVersionArchived(
  deps: VersionLifecycleDeps,
  userId: string,
  versionId: string,
  projectSlug: string,
  archived: boolean,
): Promise<ActionResult> {
  const loaded = await loadManageableVersion(deps, userId, versionId, projectSlug);
  if (!loaded.version) return { error: loaded.error };

  await deps.db
    .update(versions)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(versions.id, versionId))
    .run();

  return { success: true };
}
