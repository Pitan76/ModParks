import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "@modparks/core/db/client";
import { posts, versions, versionIdeas, ideas, versionLoaders, versionMcVersions, projectDependencies } from "@modparks/core/db/schema";
import { insertVersionRecord } from "@modparks/core/utils/versionRecord";
import { notifyNewVersion } from "@modparks/core/notifications/dispatch";
import { createSystemCommentForResolvedIdea } from "@modparks/core/versions/ideaLink";
import { pushVersionToExternalPlatforms } from "@modparks/core/versions/externalSync";
import { scanVersionFile, type VersionScanContext } from "@modparks/core/versions/scan";
import { createVersionSchema, updateVersionSchema, isAllowedExternalUrl } from "@modparks/core/validations";
import { resolveDependencyDrafts } from "@modparks/core/dependencies/create";
import { parseDependencyDraftsField } from "@modparks/core/dependencies/parseDrafts";
import { r2KeyFromUrl } from "@modparks/core/r2";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";
import { findProjectPostBySlug } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { chunkRows } from "@modparks/core/db/chunkRows";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * バージョンの作成・編集の本体。Next の Server Action と modparks-api の両方から呼ぶ。
 *
 * 戻り値は移設前の Server Action と同じ形。機能停止の確認とキャッシュの無効化は
 * 呼び出し側で行う。
 */
export type VersionDeps = {
  /** 検査・通知に要る部品一式。db もここ（scan.notify.db）から取る */
  scan: VersionScanContext;
  t: ServerErrorTranslator;
  /**
   * 応答後に回す処理を預ける。Next は after()、modparks-api は waitUntil に渡す。
   * 検査は jar Worker の往復で遅いため、アップロードの応答を待たせない
   */
  defer: (task: () => Promise<void>) => void;
};

/** 編集権限のあるプロジェクトを取る。移設前と同じく例外で弾く */
async function loadEditableProject(db: Database, projectSlug: string, userId: string) {
  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) throw new Error("Project not found");
  if (!(await canEditProject(db, project, userId))) throw new Error("Forbidden");

  return project;
}

function readVersionFields(formData: FormData) {
  return {
    versionNumber: formData.get("versionNumber"),
    mcVersions:    formData.getAll("mcVersions"),
    loaders:       formData.getAll("loaders"),
    changelog:     formData.get("changelog"),
    releaseChannel: formData.get("releaseChannel") ?? undefined,
  };
}

/** @returns 問題があれば表示用の文言 */
function checkNewFileUrl(t: ServerErrorTranslator, r2PublicUrl: string | undefined, fileUrl: string, fileName: string): string | null {
  if (!fileUrl || !fileName) return t("version.fileRequired");

  const isExternal = fileUrl.startsWith("http") && !fileUrl.includes(r2PublicUrl || "__r2__");
  if (isExternal && !isAllowedExternalUrl(fileUrl)) return t("version.disallowedDomain");

  return null;
}

/** アイデアを解決済みにし、起票者へ知らせる */
async function linkResolvedIdea(deps: VersionDeps, ideaId: string, versionId: string, versionNumber: string, projectSlug: string, userId: string) {
  const { db } = deps.scan.notify;
  await db.insert(versionIdeas).values({ versionId, ideaId }).run();
  await db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)).run();
  await createSystemCommentForResolvedIdea(deps.scan.notify, ideaId, versionId, versionNumber, projectSlug, userId);
}

/** 新しいバージョン（ファイル）を登録する */
export async function createVersion(deps: VersionDeps, userId: string, projectSlug: string, formData: FormData) {
  const { t, scan } = deps;
  const { db } = scan.notify;
  const project = await loadEditableProject(db, projectSlug, userId);

  const parsed = createVersionSchema.safeParse(readVersionFields(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const fileUrl  = formData.get("fileUrl") as string;
  const fileName = formData.get("fileName") as string;
  const fileError = checkNewFileUrl(t, scan.r2PublicUrl, fileUrl, fileName);
  if (fileError) return { error: { fileUrl: [fileError] } };

  const id = createId();

  // 依存関係はバージョンを作る前に解決する。スラッグの打ち間違いで
  // 「バージョンだけ出来て依存が入らない」状態になるのを防ぐため
  const drafts = parseDependencyDraftsField(formData.get("dependencies"));
  if (!drafts.success) return { error: { dependencies: [drafts.error] } };

  const resolvedDeps = await resolveDependencyDrafts(db, project.id, id, drafts.data);
  if (!resolvedDeps.ok) return { error: { dependencies: [resolvedDeps.error] } };

  const { versionNumber, mcVersions, loaders, releaseChannel } = parsed.data;
  const changelog = parsed.data.changelog || "";
  await insertVersionRecord(db, {
    id, versionNumber, mcVersions, loaders, changelog, releaseChannel, fileUrl, fileName,
    fileSize:      formData.get("fileSize") ? Number(formData.get("fileSize")) : null,
    fileSha256:    formData.get("fileSha256") as string | null,
    projectId:     project.id,
    uploaderId:    userId,
  });

  if (resolvedDeps.rows.length > 0) await db.insert(projectDependencies).values(resolvedDeps.rows).run();
  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  deps.defer(async () => {
    await scanVersionFile(scan, id, fileUrl, fileName);
    await notifyNewVersion(scan.notify, project, versionNumber);
  });

  const ideaId = formData.get("ideaId") as string;
  if (ideaId) await linkResolvedIdea(deps, ideaId, id, versionNumber, projectSlug, userId);

  const external = await pushVersionToExternalPlatforms({
    db, userId, project, versionNumber, changelog, releaseChannel, mcVersions, loaders, fileUrl, fileName,
    uploadToModrinth: formData.get("uploadToModrinth") === "true",
    uploadToCurseforge: formData.get("uploadToCurseforge") === "true",
  });

  return { success: true, versionId: id, external };
}

/** 既存の行を消して入れ直す。消した行はバックアップ側でも消えるよう墓標を残す */
async function replaceVersionTags(db: Database, versionId: string, loaders: string[] | undefined, mcVersions: string[] | undefined) {
  const previousLoaders = await db
    .select({ loader: versionLoaders.loader })
    .from(versionLoaders)
    .where(eq(versionLoaders.versionId, versionId))
    .all();

  await db.delete(versionLoaders).where(eq(versionLoaders.versionId, versionId)).run();
  await recordDeletion(db, "version_loaders", previousLoaders.map((l: { loader: string }) => buildRecordKey(versionId, l.loader)));

  for (const chunk of chunkRows(loaders ?? [], 2)) {
    await db.insert(versionLoaders).values(chunk.map(loader => ({ versionId, loader }))).run();
  }

  const previousMcVersions = await db
    .select({ mcVersion: versionMcVersions.mcVersion })
    .from(versionMcVersions)
    .where(eq(versionMcVersions.versionId, versionId))
    .all();

  await db.delete(versionMcVersions).where(eq(versionMcVersions.versionId, versionId)).run();
  await recordDeletion(db, "version_mc_versions", previousMcVersions.map((m: { mcVersion: string }) => buildRecordKey(versionId, m.mcVersion)));

  for (const chunk of chunkRows(mcVersions ?? [], 2)) {
    await db.insert(versionMcVersions).values(chunk.map(mc => ({ versionId, mcVersion: mc }))).run();
  }
}

/** 紐付けを外す。他のバージョンからも参照されなくなったアイデアは未解決へ戻す */
async function unlinkIdea(db: Database, versionId: string, ideaId: string) {
  await db
    .delete(versionIdeas)
    .where(and(eq(versionIdeas.versionId, versionId), eq(versionIdeas.ideaId, ideaId)))
    .run();

  const otherReferences = await db
    .select({ count: sql<number>`count(*)` })
    .from(versionIdeas)
    .where(eq(versionIdeas.ideaId, ideaId))
    .get();
  if (!otherReferences || otherReferences.count === 0) {
    await db.update(ideas).set({ status: "open" }).where(eq(ideas.id, ideaId)).run();
  }
}

/** バージョン情報を更新する */
export async function updateVersion(deps: VersionDeps, userId: string, versionId: string, projectSlug: string, formData: FormData) {
  const { t, scan } = deps;
  const { db } = scan.notify;
  const project = await loadEditableProject(db, projectSlug, userId);

  const version = await db.select().from(versions).where(eq(versions.id, versionId)).get();
  if (!version) throw new Error("Version not found");
  if (version.projectId !== project.id) throw new Error("Forbidden: Version does not belong to this project");

  const parsed = updateVersionSchema.safeParse({ ...readVersionFields(formData), fileUrl: formData.get("fileUrl") ?? undefined });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const updateData: Partial<typeof versions.$inferInsert> = {
    versionNumber: parsed.data.versionNumber,
    mcVersions:    parsed.data.mcVersions ? JSON.stringify(parsed.data.mcVersions) : undefined,
    loaders:       parsed.data.loaders ? JSON.stringify(parsed.data.loaders) : undefined,
    changelog:     parsed.data.changelog,
    releaseChannel: parsed.data.releaseChannel,
  };

  if (parsed.data.fileUrl) {
    if (!isAllowedExternalUrl(parsed.data.fileUrl)) return { error: { fileUrl: [t("version.disallowedDomain")] } };
    if (r2KeyFromUrl(scan.r2PublicUrl, version.fileUrl)) return { error: { fileUrl: [t("version.uploadedFileUrlImmutable")] } };
    updateData.fileUrl = parsed.data.fileUrl;
  }

  await db.update(versions).set(updateData).where(eq(versions.id, versionId)).run();
  await replaceVersionTags(db, versionId, parsed.data.loaders, parsed.data.mcVersions);

  const ideaId = formData.get("ideaId") as string | null;
  const existingIdea = await db
    .select({ ideaId: versionIdeas.ideaId })
    .from(versionIdeas)
    .where(eq(versionIdeas.versionId, versionId))
    .get();

  if (existingIdea && existingIdea.ideaId !== ideaId) await unlinkIdea(db, versionId, existingIdea.ideaId);
  if (ideaId && (!existingIdea || existingIdea.ideaId !== ideaId)) {
    await linkResolvedIdea(deps, ideaId, versionId, parsed.data.versionNumber ?? version.versionNumber, projectSlug, userId);
  }

  return { success: true };
}
