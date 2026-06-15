"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { versions, projects, versionIdeas, ideas, versionLoaders, versionMcVersions, users, projectMembers } from "@/db/schema";
import { createVersionSchema } from "@/lib/validations";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  const { db, userId } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) throw new Error("Project not found");
  if (project.authorId !== userId) throw new Error("Forbidden");

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
 * プロジェクトのバージョン（ファイル）を削除する Server Action
 * @param versionId 削除対象のバージョンID
 * @param projectSlug プロジェクトのSlug（権限チェックおよびリバリデーション用）
 * @returns { success: boolean } または { error: string }
 */
export async function deleteVersion(versionId: string, projectSlug: string) {
  const { db, userId } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) return { error: "Project not found" };

  // 権限チェック: オーナー、メンバー、または管理者のみ削除可能
  let isAuthorized = false;
  if (project.authorId === userId) {
    isAuthorized = true;
  } else {
    // 管理者チェック
    const userRecord = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
    if (userRecord?.role === "admin") {
      isAuthorized = true;
    } else {
      // メンバーチェック
      const memberRecord = await db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id)).all();
      if (memberRecord.some(m => m.userId === userId)) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) return { error: "Forbidden" };

  const version = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return { error: "Version not found" };

  // TODO: 必要に応じて R2 ストレージからファイルを削除する処理をここに追加 (deleteFromR2 など)
  
  await db.delete(versions).where(eq(versions.id, versionId)).run();

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/edit`);

  return { success: true };
}
