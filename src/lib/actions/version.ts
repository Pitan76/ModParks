"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, versions, versionIdeas, ideas, versionLoaders, versionMcVersions, comments, projectDependencies } from "@/db/schema";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { notifyNewVersion, notifyToUser, resolveActor } from "@/lib/notifications/notify";
import { scanVersionFile } from "@/lib/actions/versionScan";
import { createVersionSchema, updateVersionSchema } from "@/lib/validations";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getR2Bucket, deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { after } from "next/server";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { assertFeatureEnabled } from "@/lib/runtime/guard";
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
 * アイデアが解決された際に自動でシステムコメントを追加し、起票者へ通知を送るヘルパー関数。
 */
async function createSystemCommentForResolvedIdea(
  db: Database,
  ideaId: string,
  versionId: string,
  versionNumber: string,
  projectSlug: string,
  userId: string
) {
  const commentId = createId();
  const content = `このアイデアはバージョン [${versionNumber}](/projects/${projectSlug}) で解決されました。`;

  await db.insert(comments).values({
    id: commentId,
    postId: ideaId,
    content,
    contentFormat: "markdown",
    authorId: userId,
  }).run();

  const idea = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      authorId: posts.authorId,
    })
    .from(ideas)
    .innerJoin(posts, eq(posts.id, ideas.id))
    .where(eq(ideas.id, ideaId))
    .get();

  if (idea) {
    const actor = await resolveActor(db, userId);
    await notifyToUser(db, idea.authorId, userId, "comment", {
      kind: "idea",
      slug: idea.slug,
      title: idea.title,
      ...actor,
    });
  }
}

/**
 * プロジェクトに対する新しいバージョン（ファイル）を登録する Server Action。
 */
export const createVersion = async (projectSlug: string, formData: FormData) => {
  await assertFeatureEnabled("upload");

  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);

  if (!project) throw new Error("Project not found");
  await assertProjectAccess(db, project, session);

  const raw = {
    versionNumber: formData.get("versionNumber"),
    mcVersions:    formData.getAll("mcVersions"),
    loaders:       formData.getAll("loaders"),
    changelog:     formData.get("changelog"),
    releaseChannel: formData.get("releaseChannel") ?? undefined,
  };

  const parsed = createVersionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const fileUrl  = formData.get("fileUrl") as string;
  const fileName = formData.get("fileName") as string;

  if (!fileUrl || !fileName) {
    return { error: { fileUrl: [t("version.fileRequired")] } };
  }

  const isExternal = fileUrl.startsWith("http") && !fileUrl.includes(process.env.R2_PUBLIC_URL || "__r2__");
  if (isExternal && !isAllowedExternalUrl(fileUrl)) {
    return { error: { fileUrl: [t("version.disallowedDomain")] } };
  }

  const id = createId();

  await insertVersionRecord(db, {
    id,
    versionNumber: parsed.data.versionNumber,
    mcVersions:    parsed.data.mcVersions,
    loaders:       parsed.data.loaders,
    changelog:     parsed.data.changelog || "",
    releaseChannel: parsed.data.releaseChannel,
    fileUrl,
    fileName,
    fileSize:      formData.get("fileSize") ? Number(formData.get("fileSize")) : null,
    fileSha256:    formData.get("fileSha256") as string | null,
    projectId:     project.id,
    uploaderId:    session.user.id,
  });

  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  after(async () => {
    await scanVersionFile(db, id, fileUrl, fileName);
    await notifyNewVersion(db, project, parsed.data.versionNumber);
  });

  const ideaId = formData.get("ideaId") as string;
  if (ideaId) {
    await db.insert(versionIdeas).values({ versionId: id, ideaId }).run();
    await db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)).run();
    await createSystemCommentForResolvedIdea(db, ideaId, id, parsed.data.versionNumber, projectSlug, session.user.id);
  }

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/ideas`);
  if (ideaId) revalidatePath(`/ideas/${ideaId}`);

  return { success: true, versionId: id };
};

/**
 * プロジェクトのバージョン情報を更新する Server Action。
 */
export const updateVersion = async (versionId: string, projectSlug: string, formData: FormData) => {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) throw new Error("Project not found");

  await assertProjectAccess(db, project, session);

  const version = await db.select().from(versions).where(eq(versions.id, versionId)).get();
  if (!version) throw new Error("Version not found");
  if (version.projectId !== project.id) throw new Error("Forbidden: Version does not belong to this project");

  const raw = {
    versionNumber: formData.get("versionNumber"),
    mcVersions:    formData.getAll("mcVersions"),
    loaders:       formData.getAll("loaders"),
    changelog:     formData.get("changelog"),
    releaseChannel: formData.get("releaseChannel") ?? undefined,
    fileUrl:       formData.get("fileUrl") ?? undefined,
  };

  const parsed = updateVersionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const updateData: any = {
    versionNumber: parsed.data.versionNumber,
    mcVersions:    parsed.data.mcVersions ? JSON.stringify(parsed.data.mcVersions) : undefined,
    loaders:       parsed.data.loaders ? JSON.stringify(parsed.data.loaders) : undefined,
    changelog:     parsed.data.changelog,
    releaseChannel: parsed.data.releaseChannel,
  };

  if (parsed.data.fileUrl) {
    if (!isAllowedExternalUrl(parsed.data.fileUrl)) {
      return { error: { fileUrl: [t("version.disallowedDomain")] } };
    }
    const r2Key = getR2KeyFromUrl(version.fileUrl);
    if (r2Key) return { error: { fileUrl: [t("version.uploadedFileUrlImmutable")] } };
    updateData.fileUrl = parsed.data.fileUrl;
  }

  await db.update(versions).set(updateData).where(eq(versions.id, versionId)).run();

  const previousLoaders = await db
    .select({ loader: versionLoaders.loader })
    .from(versionLoaders)
    .where(eq(versionLoaders.versionId, versionId))
    .all();

  await db.delete(versionLoaders).where(eq(versionLoaders.versionId, versionId)).run();
  await recordDeletion(
    db,
    "version_loaders",
    previousLoaders.map((l: { loader: string }) => buildRecordKey(versionId, l.loader))
  );

  if (parsed.data.loaders && parsed.data.loaders.length > 0) {
    await db.insert(versionLoaders).values(parsed.data.loaders.map(loader => ({ versionId, loader }))).run();
  }

  const previousMcVersions = await db
    .select({ mcVersion: versionMcVersions.mcVersion })
    .from(versionMcVersions)
    .where(eq(versionMcVersions.versionId, versionId))
    .all();

  await db.delete(versionMcVersions).where(eq(versionMcVersions.versionId, versionId)).run();
  await recordDeletion(
    db,
    "version_mc_versions",
    previousMcVersions.map((m: { mcVersion: string }) => buildRecordKey(versionId, m.mcVersion))
  );

  if (parsed.data.mcVersions && parsed.data.mcVersions.length > 0) {
    await db.insert(versionMcVersions).values(parsed.data.mcVersions.map(mc => ({ versionId, mcVersion: mc }))).run();
  }

  const ideaId = formData.get("ideaId") as string | null;
  const existingIdea = await db
    .select({ ideaId: versionIdeas.ideaId })
    .from(versionIdeas)
    .where(eq(versionIdeas.versionId, versionId))
    .get();

  if (existingIdea && existingIdea.ideaId !== ideaId) {
    await db
      .delete(versionIdeas)
      .where(and(eq(versionIdeas.versionId, versionId), eq(versionIdeas.ideaId, existingIdea.ideaId)))
      .run();
    const otherReferences = await db
      .select({ count: sql<number>`count(*)` })
      .from(versionIdeas)
      .where(eq(versionIdeas.ideaId, existingIdea.ideaId))
      .get();
    if (!otherReferences || otherReferences.count === 0) {
      await db.update(ideas).set({ status: "open" }).where(eq(ideas.id, existingIdea.ideaId)).run();
      revalidatePath(`/ideas/${existingIdea.ideaId}`);
    }
  }

  if (ideaId && (!existingIdea || existingIdea.ideaId !== ideaId)) {
    await db.insert(versionIdeas).values({ versionId, ideaId }).run();
    await db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)).run();
    const finalVersionNumber = parsed.data.versionNumber ?? version.versionNumber;
    await createSystemCommentForResolvedIdea(db, ideaId, versionId, finalVersionNumber, projectSlug, session.user.id);
    revalidatePath(`/ideas/${ideaId}`);
  }

  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/ideas`);
  return { success: true };
};

/**
 * プロジェクトのバージョン（ファイル）を削除する Server Action。
 */
export const deleteVersion = async (versionId: string, projectSlug: string): Promise<ActionResult> => {
  const loaded = await loadManageableVersion(versionId, projectSlug);
  if (loaded.error !== undefined) return { error: loaded.error };
  const { db, project, version } = loaded;

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

  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

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
  const { db, project } = loaded;

  await db
    .update(versions)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(versions.id, versionId))
    .run();

  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};
