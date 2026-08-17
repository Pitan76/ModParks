"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, versions, versionIdeas, ideas, versionLoaders, versionMcVersions, projectDependencies } from "@/db/schema";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { notifyNewVersion } from "@/lib/notifications/notify";
import { createSystemCommentForResolvedIdea } from "@/lib/actions/versionIdeaLink";
import { pushVersionToExternalPlatforms } from "@/lib/actions/versionExternalSync";
import { scanVersionFile } from "@/lib/actions/versionScan";
import { createVersionSchema, updateVersionSchema } from "@/lib/validations";
import { resolveDependencyDrafts } from "@/lib/dependencies/create";
import { parseDependencyDraftsField } from "@/lib/dependencies/parseDrafts";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getR2KeyFromUrl } from "@/lib/r2";
import { after } from "next/server";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { assertFeatureEnabled } from "@/lib/runtime/guard";
import { chunkRows } from "@/lib/db/chunkRows";

// 再エクスポートは置かない。"use server" ファイルは値を再公開できず、型を再公開すると
// サーバー専用モジュールがクライアントバンドルへ引き込まれるため、呼び出し側は
// deleteVersion / setVersionArchived を @/lib/actions/versionLifecycle から、
// ExternalUploadSummary を @/lib/externalSync/uploadSummary から直接 import する。

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

  const updateData: Partial<typeof versions.$inferInsert> = {
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
