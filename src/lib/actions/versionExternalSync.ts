import { userSettings } from "@/db/schema";
import { createModrinthVersion } from "@/lib/modrinthUpload";
import { fetchCfGameVersionMap, resolveCfGameVersionIds, uploadCfFile } from "@/lib/curseforgeUpload";
import { eq } from "drizzle-orm";
import type { ProjectPost } from "@/types/post";
import type { Database } from "@/lib/db";
import type { ExternalUploadResult, ExternalUploadSummary } from "@/lib/externalSync/uploadSummary";

type PushVersionParams = {
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
};

async function pushToModrinth(
  params: PushVersionParams,
  settings: { modrinthApiKey: string | null } | undefined,
  fileBlob: Blob,
): Promise<ExternalUploadResult> {
  if (!params.project.modrinthId || !settings?.modrinthApiKey) {
    return { ok: false, error: "Modrinth is not linked or the API key is not configured." };
  }
  try {
    await createModrinthVersion(settings.modrinthApiKey.trim(), {
      modrinthProjectId: params.project.modrinthId,
      versionNumber: params.versionNumber,
      changelog: params.changelog,
      gameVersions: params.mcVersions,
      loaders: params.loaders,
      releaseChannel: params.releaseChannel,
      file: fileBlob,
      fileName: params.fileName,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function pushToCurseforge(
  params: PushVersionParams,
  settings: { curseforgeUploadApiToken: string | null } | undefined,
  fileBlob: Blob,
): Promise<ExternalUploadResult> {
  if (!params.project.curseforgeId || !settings?.curseforgeUploadApiToken) {
    return { ok: false, error: "CurseForge is not linked or the upload API token is not configured." };
  }
  try {
    const token = settings.curseforgeUploadApiToken.trim();
    const versionMap = await fetchCfGameVersionMap(token);
    const { ids } = resolveCfGameVersionIds([...params.mcVersions, ...params.loaders], versionMap);
    const releaseType = ["alpha", "beta", "release"].includes(params.releaseChannel) ? params.releaseChannel : "release";
    await uploadCfFile(
      params.project.curseforgeId,
      token,
      {
        changelog: params.changelog,
        changelogType: "markdown",
        displayName: params.versionNumber,
        gameVersions: ids,
        releaseType: releaseType as "alpha" | "beta" | "release",
      },
      fileBlob,
      params.fileName,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * アップロード済みのファイル（fileUrl）を取得し直し、Modrinth / CurseForge へも
 * 新規バージョンとして同時アップロードする。
 *
 * modparksの `versions` は正規化のためJSON文字列で mcVersions/loaders を持つが、
 * 外部APIはどちらも配列を要求するため、ここでパース済みの配列を受け取る。
 * 失敗しても modparks 側の登録自体は既に完了しているため、例外は投げずに結果を返す。
 */
export async function pushVersionToExternalPlatforms(params: PushVersionParams): Promise<ExternalUploadSummary> {
  const { db, userId, uploadToModrinth, uploadToCurseforge } = params;
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

  if (uploadToModrinth) summary.modrinth = await pushToModrinth(params, settings, fileBlob);
  if (uploadToCurseforge) summary.curseforge = await pushToCurseforge(params, settings, fileBlob);

  return summary;
}
