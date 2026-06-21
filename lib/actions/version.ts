"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { versions, projects, versionIdeas, ideas, versionLoaders, versionMcVersions, users, projectMembers } from "@/db/schema";
import { createVersionSchema } from "@/lib/validations";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * IDを指定してバージョン詳細を取得する
 */
export async function getVersionById(versionId: string) {
  const db = await getDatabase();
  
  const version = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return null;

  return version;
}

/**
 * プロジェクトに対する新しいバージョン（ファイル）を登録する Server Action
 * ファイルアップロード方式と外部URL方式の両方に対応
 * @param projectSlug 対象プロジェクトのSlug
 * @param formData フォームデータ (versionNumber, mcVersions, loaders, changelog, fileUrl, fileName 等)
 * @returns { success: boolean, versionId: string } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 * @throws Forbidden プロジェクトの作成者ではない場合
 * @throws Error プロジェクトが見つからない場合
 */
export async function createVersion(projectSlug: string, formData: FormData) {
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
  };

  const parsed = createVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const fileUrl  = formData.get("fileUrl") as string;
  const fileName = formData.get("fileName") as string;

  if (!fileUrl || !fileName) {
    return { error: { fileUrl: ["ファイルをアップロードするか、外部URLを入力してください"] } };
  }

  // 外部URLの場合はドメインのホワイトリスト検証
  const isExternal = fileUrl.startsWith("http") && !fileUrl.includes(process.env.R2_PUBLIC_URL || "__r2__");
  if (isExternal && !isAllowedExternalUrl(fileUrl)) {
    return { error: { fileUrl: ["許可されていないドメインのURLです。GitHub, Modrinth, CurseForge のURLを使用してください。"] } };
  }

  const id = createId();

  await db.insert(versions).values({
    id,
    versionNumber: parsed.data.versionNumber,
    mcVersions:    JSON.stringify(parsed.data.mcVersions),
    loaders:       JSON.stringify(parsed.data.loaders),
    changelog:     parsed.data.changelog || "",
    fileUrl,
    fileName,
    fileSize:      formData.get("fileSize") ? Number(formData.get("fileSize")) : null,
    fileSha256:    formData.get("fileSha256") as string | null,
    projectId:     project.id,
    createdAt:     new Date(),
  }).run();

  // 対応ローダーの保存 (複数)
  if (parsed.data.loaders && parsed.data.loaders.length > 0) {
    const loaderValues = parsed.data.loaders.map(loader => ({
      versionId: id,
      loader,
    }));
    await db.insert(versionLoaders).values(loaderValues).run();
  }

  // 対応MCバージョンの保存 (複数)
  if (parsed.data.mcVersions && parsed.data.mcVersions.length > 0) {
    const mcValues = parsed.data.mcVersions.map(mc => ({
      versionId: id,
      mcVersion: mc,
    }));
    await db.insert(versionMcVersions).values(mcValues).run();
  }

  const ideaId = formData.get("ideaId") as string;
  if (ideaId) {
    await db.insert(versionIdeas).values({
      versionId: id,
      ideaId,
    }).run();
    // アイデアを実現済みに更新
    await db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)).run();
  }

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/ideas`);
  if (ideaId) {
    revalidatePath(`/ideas/${ideaId}`);
  }

  return { success: true, versionId: id };
}

/**
 * プロジェクトのバージョン情報を更新する Server Action
 */
export async function updateVersion(versionId: string, projectSlug: string, formData: FormData) {
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
  };

  const parsed = createVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await db.update(versions).set({
    versionNumber: parsed.data.versionNumber,
    mcVersions:    JSON.stringify(parsed.data.mcVersions),
    loaders:       JSON.stringify(parsed.data.loaders),
    changelog:     parsed.data.changelog || "",
  }).where(eq(versions.id, versionId)).run();

  // Loader と mcVersion のテーブルも更新
  await db.delete(versionLoaders).where(eq(versionLoaders.versionId, versionId)).run();
  if (parsed.data.loaders.length > 0) {
    await db.insert(versionLoaders).values(parsed.data.loaders.map(loader => ({ versionId, loader }))).run();
  }

  await db.delete(versionMcVersions).where(eq(versionMcVersions.versionId, versionId)).run();
  if (parsed.data.mcVersions.length > 0) {
    await db.insert(versionMcVersions).values(parsed.data.mcVersions.map(mc => ({ versionId, mcVersion: mc }))).run();
  }

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
}

/**
 * プロジェクトのバージョン（ファイル）を削除する Server Action
 * @param versionId 削除対象のバージョンID
 * @param projectSlug プロジェクトのSlug（権限チェックおよびリバリデーション用）
 * @returns { success: boolean } または { error: string }
 */
export async function deleteVersion(versionId: string, projectSlug: string) {
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

  // TODO: 必要に応じて R2 ストレージからファイルを削除する処理をここに追加 (deleteFromR2 など)
  
  await db.delete(versions).where(eq(versions.id, versionId)).run();

  return { success: true };
}
