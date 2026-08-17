"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, versions, versionIdeas, ideas, versionLoaders, versionMcVersions, comments, projectDependencies, userSettings } from "@/db/schema";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { createModrinthVersion } from "@/lib/modrinthUpload";
import { fetchCfGameVersionMap, resolveCfGameVersionIds, uploadCfFile } from "@/lib/curseforgeUpload";
import { notifyNewVersion, notifyToUser, resolveActor } from "@/lib/notifications/notify";
import { scanVersionFile } from "@/lib/actions/versionScan";
import { createVersionSchema, dependencyDraftsSchema, updateVersionSchema } from "@/lib/validations";
import { resolveDependencyDrafts } from "@/lib/dependencies/create";
import type { DependencyDraft } from "@/lib/dependencies/types";
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
import { chunkRows } from "@/lib/db/chunkRows";
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
 * フォームから来た依存関係の下書き（JSON文字列）を検証して取り出す。
 *
 * 依存が無いのが普通なので、未指定は空配列として扱い、
 * 壊れた JSON だけをエラーにする。
 */
function parseDependencyDraftsField(
  raw: FormDataEntryValue | null,
): { success: true; data: DependencyDraft[] } | { success: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return { success: true, data: [] };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, error: "Invalid dependencies payload" };
  }

  const parsed = dependencyDraftsSchema.safeParse(json);
  if (!parsed.success) return { success: false, error: "Invalid dependencies payload" };

  return { success: true, data: parsed.data };
}

type ExternalUploadResult = { ok: true } | { ok: false; error: string };
export type ExternalUploadSummary = {
  modrinth?: ExternalUploadResult;
  curseforge?: ExternalUploadResult;
};

/**
 * アップロード済みのファイル（fileUrl）を取得し直し、Modrinth / CurseForge へも
 * 新規バージョンとして同時アップロードする。
 *
 * modparksの `versions` は正規化のためJSON文字列で mcVersions/loaders を持つが、
 * 外部APIはどちらも配列を要求するため、ここでパース済みの配列を受け取る。
 * 失敗しても modparks 側の登録自体は既に完了しているため、例外は投げずに結果を返す。
 */
async function pushVersionToExternalPlatforms(params: {
  db: Database;
  userId: string;
  project: ProjectPost;
  versionNumber: string;
  changelog: string;
  releaseChannel: string;
  mcVersions: string[];
  loaders: string[];
  fileUrl: string;
  fileName: string;
  uploadToModrinth: boolean;
  uploadToCurseforge: boolean;
}): Promise<ExternalUploadSummary> {
  const { db, userId, project, uploadToModrinth, uploadToCurseforge } = params;
  const summary: ExternalUploadSummary = {};
  if (!uploadToModrinth && !uploadToCurseforge) return summary;

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

  const fileRes = await fetch(params.fileUrl);
  if (!fileRes.ok) {
    const error = `Failed to fetch uploaded file for external sync. Status: ${fileRes.status}`;
    if (uploadToModrinth) summary.modrinth = { ok: false, error };
    if (uploadToCurseforge) summary.curseforge = { ok: false, error };
    return summary;
  }
  const fileBlob = await fileRes.blob();

  if (uploadToModrinth) {
    if (!project.modrinthId || !settings?.modrinthApiKey) {
      summary.modrinth = { ok: false, error: "Modrinth is not linked or the API key is not configured." };
    } else {
      try {
        await createModrinthVersion(settings.modrinthApiKey.trim(), {
          modrinthProjectId: project.modrinthId,
          versionNumber: params.versionNumber,
          changelog: params.changelog,
          gameVersions: params.mcVersions,
          loaders: params.loaders,
          releaseChannel: params.releaseChannel,
          file: fileBlob,
          fileName: params.fileName,
        });
        summary.modrinth = { ok: true };
      } catch (err) {
        summary.modrinth = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  if (uploadToCurseforge) {
    if (!project.curseforgeId || !settings?.curseforgeUploadApiToken) {
      summary.curseforge = { ok: false, error: "CurseForge is not linked or the upload API token is not configured." };
    } else {
      try {
        const token = settings.curseforgeUploadApiToken.trim();
        const versionMap = await fetchCfGameVersionMap(token);
        const { ids } = resolveCfGameVersionIds([...params.mcVersions, ...params.loaders], versionMap);
        await uploadCfFile(
          project.curseforgeId,
          token,
          {
            changelog: params.changelog,
            changelogType: "markdown",
            displayName: params.versionNumber,
            gameVersions: ids,
            releaseType: (["alpha", "beta", "release"].includes(params.releaseChannel) ? params.releaseChannel : "release") as "alpha" | "beta" | "release",
          },
          fileBlob,
          params.fileName,
        );
        summary.curseforge = { ok: true };
      } catch (err) {
        summary.curseforge = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  return summary;
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

  // 依存関係はバージョンを作る前に解決する。スラッグの打ち間違いで
  // 「バージョンだけ出来て依存が入らない」状態になるのを防ぐため
  const drafts = parseDependencyDraftsField(formData.get("dependencies"));
  if (!drafts.success) return { error: { dependencies: [drafts.error] } };

  const resolvedDeps = await resolveDependencyDrafts(db, project.id, id, drafts.data);
  if (!resolvedDeps.ok) return { error: { dependencies: [resolvedDeps.error] } };

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

  if (resolvedDeps.rows.length > 0) {
    await db.insert(projectDependencies).values(resolvedDeps.rows).run();
  }

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

  const uploadToModrinth = formData.get("uploadToModrinth") === "true";
  const uploadToCurseforge = formData.get("uploadToCurseforge") === "true";
  const external = await pushVersionToExternalPlatforms({
    db,
    userId: session.user.id,
    project,
    versionNumber: parsed.data.versionNumber,
    changelog: parsed.data.changelog || "",
    releaseChannel: parsed.data.releaseChannel,
    mcVersions: parsed.data.mcVersions,
    loaders: parsed.data.loaders,
    fileUrl,
    fileName,
    uploadToModrinth,
    uploadToCurseforge,
  });

  return { success: true, versionId: id, external };
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

  for (const chunk of chunkRows(parsed.data.loaders ?? [], 2)) {
    await db.insert(versionLoaders).values(chunk.map(loader => ({ versionId, loader }))).run();
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

  for (const chunk of chunkRows(parsed.data.mcVersions ?? [], 2)) {
    await db.insert(versionMcVersions).values(chunk.map(mc => ({ versionId, mcVersion: mc }))).run();
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



  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};
