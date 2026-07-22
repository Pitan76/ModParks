"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { versions, projects, versionIdeas, ideas, versionLoaders, versionMcVersions } from "@/db/schema";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { notifyNewVersion } from "@/lib/notifications/notify";
import { createVersionSchema, updateVersionSchema } from "@/lib/validations";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getR2Bucket, deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { after } from "next/server";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";

/**
 * プロジェクトに対する新しいバージョン（ファイル）を登録する Server Action。
 */
export const createVersion = async (projectSlug: string, formData: FormData) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

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
    return { error: { fileUrl: ["ファイルをアップロードするか、外部URLを入力してください"] } };
  }

  const isExternal = fileUrl.startsWith("http") && !fileUrl.includes(process.env.R2_PUBLIC_URL || "__r2__");
  if (isExternal && !isAllowedExternalUrl(fileUrl)) {
    return { error: { fileUrl: ["許可されていないドメインのURLです。GitHub, Modrinth, CurseForge のURLを使用してください。"] } };
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
  });

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  after(async () => {
    await notifyNewVersion(db, project, parsed.data.versionNumber);
  });

  const ideaId = formData.get("ideaId") as string;
  if (ideaId) {
    await db.insert(versionIdeas).values({ versionId: id, ideaId }).run();
    await db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)).run();
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
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.slug, projectSlug)).get();
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
      return { error: { fileUrl: ["許可されていないドメインのURLです。GitHub, Modrinth, CurseForge のURLを使用してください。"] } };
    }
    const r2Key = getR2KeyFromUrl(version.fileUrl);
    if (r2Key) return { error: { fileUrl: ["直接アップロードされたファイルはURLを変更できません。"] } };
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

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};

/**
 * プロジェクトのバージョン（ファイル）を削除する Server Action。
 */
export const deleteVersion = async (versionId: string, projectSlug: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) return { error: "Project not found" };

  try {
    await assertProjectAccess(db, project, session);
  } catch (e) {
    return { error: "Forbidden" };
  }

  const version = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return { error: "Version not found" };
  if (version.projectId !== project.id) return { error: "Forbidden: Version does not belong to this project" };

  const r2Key = getR2KeyFromUrl(version.fileUrl);
  if (r2Key) {
    try {
      const bucket = await getR2Bucket();
      await deleteFromR2(bucket, r2Key);
    } catch (e) {
      console.error(`[deleteVersion] Failed to delete R2 object: ${r2Key}`, e);
    }
  }

  await db.delete(versions).where(eq(versions.id, versionId)).run();
  await recordDeletion(db, "versions", versionId);

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};

/**
 * バージョンのアーカイブ状態を切り替える Server Action。
 */
export const setVersionArchived = async (versionId: string, projectSlug: string, archived: boolean) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) return { error: "Project not found" };

  try {
    await assertProjectAccess(db, project, session);
  } catch (e) {
    return { error: "Forbidden" };
  }

  const version = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return { error: "Version not found" };
  if (version.projectId !== project.id) return { error: "Forbidden: Version does not belong to this project" };

  await db
    .update(versions)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(versions.id, versionId))
    .run();

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
};
