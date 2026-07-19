"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { versions, projects, versionIdeas, ideas, versionLoaders, versionMcVersions, users, projectMembers } from "@/db/schema";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { notifyNewVersion } from "@/lib/notifications/notify";
import { createVersionSchema } from "@/lib/validations";
import { isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getR2Bucket, deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { after } from "next/server";
import { extractAndUploadRecipes } from "@/lib/utils/recipe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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
    releaseChannel: formData.get("releaseChannel") ?? undefined,
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

  // 新バージョン登録をプロジェクトの最終更新日時に反映（「最近更新順」ソート用）
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  after(async () => {
    await notifyNewVersion(db, project, parsed.data.versionNumber);
  });

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
    releaseChannel: formData.get("releaseChannel") ?? undefined,
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
    releaseChannel: parsed.data.releaseChannel,
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

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

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

  // R2 上に実体があるファイルのみ削除（外部URLはスキップ）。
  // ストレージ削除失敗でDB削除まで巻き込まないよう境界で握りつぶす。
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
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true };
}

/**
 * バージョンのアーカイブ状態を切り替える Server Action。
 * アーカイブ済みバージョンは公開一覧・APIレスポンス・ダウンロードから除外され、
 * 作者・メンバー・管理者のみが管理画面で閲覧できる。ファイル実体は削除しない。
 * @param versionId 対象のバージョンID
 * @param projectSlug プロジェクトのSlug（権限チェックおよびリバリデーション用）
 * @param archived true でアーカイブ、false でアーカイブ解除
 * @returns { success: boolean } または { error: string }
 */
export async function setVersionArchived(versionId: string, projectSlug: string, archived: boolean) {
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
}

export async function extractRecipesFromVersion(versionId: string, projectSlug: string) {
  const { db } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) return { error: "Project not found" };

  await assertProjectAccess(project.id);

  const version = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, project.id)))
    .get();

  if (!version) return { error: "Version not found" };

  if (!version.fileUrl) {
    return { error: "No file URL associated with this version" };
  }

  const r2Key = getR2KeyFromUrl(version.fileUrl);
  if (!r2Key) {
    return { error: "File is not stored in R2. Cannot extract recipes from external URLs." };
  }

  try {
    const R2 = await getR2Bucket();
    const object = await R2.get(r2Key);
    
    if (!object) {
      return { error: "File not found in R2." };
    }

    const arrayBuffer = await object.arrayBuffer();

    const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
    let cdnSecret = process.env.RECIPE_CDN_SECRET;
    
    if (!cdnSecret) {
      try {
        const { env } = await getCloudflareContext({ async: true });
        if ((env as any).RECIPE_CDN_SECRET) {
          cdnSecret = (env as any).RECIPE_CDN_SECRET;
        }
      } catch (e) {}
    }

    const useCdnApi = process.env.USE_RECIPE_CDN_API === "true";

    const extractedCount = await extractAndUploadRecipes(
      arrayBuffer,
      cdnUrl,
      cdnSecret,
      useCdnApi,
      R2
    );

    return { success: true, count: extractedCount };
  } catch (err: any) {
    console.error("Failed to extract recipes:", err);
    return { error: err.message || "Failed to extract recipes" };
  }
}
