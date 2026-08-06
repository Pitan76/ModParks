"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, projects, versions } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { buildR2Key, getR2PublicUrl, getR2Bucket, uploadToR2, deleteFromR2 } from "@/lib/r2";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { notifyNewVersion } from "@/lib/notifications/notify";
import { channelFromGithubPrerelease } from "@/lib/releaseChannels";
import { parseModJar } from "@/lib/services/jar";
import { scanVersionFile } from "@/lib/actions/versionScan";
import { isAllowedExternalUrl } from "@/lib/validations";
import {
  fetchGithubReleases,
  fetchLatestGithubRelease,
  pickPrimaryAsset,
  downloadGithubAsset,
  normalizeGithubRepo,
  type GithubRelease,
  type GithubReleaseAsset,
  type GithubImportMode,
} from "@/lib/utils/github";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { getRepoAccessToken } from "@/lib/utils/githubRepoAccess";
import type { Database } from "@/lib/db";

/** Worker のメモリ制約を踏まえたダウンロード/解析の上限 */
const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB

type ImportResult = { success: true; versionId: string; versionNumber: string } | { error: string };

/** 取り込んだファイルの所在。R2 に置いた場合のみ key を持つ */
type ImportedFile = { fileUrl: string; fileSize: number | null; fileSha256: string | null; r2Key?: string };

function stripVPrefix(tag: string): string {
  return tag.replace(/^v/i, "").trim();
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 連携リポジトリの Release 一覧を取得する（UI プレビュー用）。
 */
export async function listGithubReleases(projectSlug: string): Promise<
  { success: true; releases: Pick<GithubRelease, "id" | "tag_name" | "name" | "prerelease" | "published_at">[] } | { error: string }
> {
  try {
    const { db, session } = await getAuthenticatedDb();
    const project = await findProjectPostBySlug(db, projectSlug);
    if (!project) return { error: "Project not found" };
    await assertProjectAccess(db, project, session);
    if (!project.githubRepo) return { error: "No GitHub repository linked to this project." };

    // 非公開リポジトリは、本人がインストールした GitHub App のトークンでのみ読める
    const repoToken = await getRepoAccessToken(db, project.authorId, project.githubRepo);
    const releases = await fetchGithubReleases(project.githubRepo, repoToken);
    return {
      success: true,
      releases: releases.map((r) => ({
        id: r.id,
        tag_name: r.tag_name,
        name: r.name,
        prerelease: r.prerelease,
        published_at: r.published_at,
      })),
    };
  } catch (e: any) {
    return { error: e?.message || "Failed to list releases." };
  }
}

/** 取り込み対象の Release を決定する。prefetch 済みならそれを優先する */
async function resolveRelease(
  repo: string,
  releaseId?: number,
  prefetchedRelease?: GithubRelease | null,
  repoToken?: string
): Promise<GithubRelease | null> {
  if (prefetchedRelease !== undefined) return prefetchedRelease;
  if (releaseId != null) {
    const all = await fetchGithubReleases(repo, repoToken);
    return all.find((r) => r.id === releaseId) ?? null;
  }
  return fetchLatestGithubRelease(repo, repoToken);
}

/** アセットをダウンロードして R2 へ格納する */
async function storeAssetToR2(
  projectSlug: string,
  asset: GithubReleaseAsset,
  repoToken?: string
): Promise<ImportedFile | { error: string }> {
  if (asset.size > MAX_ASSET_SIZE) {
    return { error: `Asset is too large to import (max ${MAX_ASSET_SIZE / 1024 / 1024}MB).` };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await downloadGithubAsset(asset, repoToken);
  } catch (e: any) {
    return { error: e?.message || "Failed to download release asset." };
  }

  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = buildR2Key("mod", projectSlug, `${createId()}/${safeFileName}`);
  const contentType = asset.name.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/java-archive";

  try {
    const fileSha256 = await sha256Hex(arrayBuffer);
    const bucket = await getR2Bucket();
    await uploadToR2(bucket, key, arrayBuffer, contentType);
    return { fileUrl: getR2PublicUrl(key), fileSize: asset.size, fileSha256, r2Key: key };
  } catch (e: any) {
    return { error: e?.message || "Failed to store the release file." };
  }
}

/**
 * アセットを取り込まず、GitHub の配布 URL をそのまま外部リンクとして使う。
 * 非公開リポジトリの URL は誰も辿れないため、この方式は公開リポジトリ限定。
 */
function linkToAsset(asset: GithubReleaseAsset): ImportedFile | { error: string } {
  const url = asset.browser_download_url;
  if (!url || !isAllowedExternalUrl(url)) return { error: "The release asset URL is not an allowed external URL." };
  return { fileUrl: url, fileSize: asset.size, fileSha256: null };
}

/**
 * 内部システム用のインポート関数（セッション・権限チェックなし）。Webhook等から使用する。
 */
export async function importGithubReleaseSystem(
  db: Database,
  /** authorId は Webhook 経由の自動取り込みで、アップロード実行者として記録する */
  project: { id: string; slug: string; githubRepo: string | null; authorId: string },
  releaseId?: number,
  prefetchedRelease?: GithubRelease | null,
  /** 非公開リポジトリを扱う場合に必要な GitHub App の installation token */
  repoToken?: string,
  mode: GithubImportMode = "file"
): Promise<ImportResult> {
  const repo = project.githubRepo ? normalizeGithubRepo(project.githubRepo) : null;
  if (!repo) return { error: "No valid GitHub repository linked to this project." };

  let release: GithubRelease | null = null;
  try {
    release = await resolveRelease(repo, releaseId, prefetchedRelease, repoToken);
  } catch (e: any) {
    return { error: e?.message || "Failed to fetch GitHub release." };
  }
  if (!release) return { error: "No release found in the linked repository." };

  const asset = pickPrimaryAsset(release);
  if (!asset) return { error: "No downloadable .jar/.zip asset found in the release." };

  // R2 へのアップロードを解析より先に行うのは、非公開リポジトリのアセット URL を
  // jar Worker 側から取得できない（トークンを持たない）ため。
  // R2 キー経由なら公開/非公開を問わず解析できる。
  const stored = mode === "link" ? linkToAsset(asset) : await storeAssetToR2(project.slug, asset, repoToken);
  if ("error" in stored) return stored;

  // 解析。Service Binding 越しに巨大なバイト列を渡さず、所在だけを Worker に渡す
  let parsed = { detectedVersion: "", detectedLoaders: [] as string[], detectedMcVersions: [] as string[] };
  try {
    parsed = await parseModJar(stored.r2Key ? { kind: "r2", key: stored.r2Key } : { kind: "url", url: stored.fileUrl });
  } catch {
    // 解析失敗時はタグ名などのフォールバックで続行
  }

  const versionNumber = parsed.detectedVersion || stripVPrefix(release.tag_name) || release.tag_name;

  // 重複チェック（同一プロジェクトで同じバージョン番号が既にある）。
  // バージョン番号は解析結果に依存するためアップロード後にしか判定できず、
  // 重複だった場合は置いたばかりのオブジェクトを消してから戻る。
  const existing = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(eq(versions.projectId, project.id), eq(versions.versionNumber, versionNumber)))
    .get();
  if (existing) {
    if (stored.r2Key) {
      try {
        await deleteFromR2(await getR2Bucket(), stored.r2Key);
      } catch (e: unknown) {
        console.error("Failed to clean up R2 object after duplicate version:", e);
      }
    }
    return { error: `Version '${versionNumber}' has already been imported.` };
  }

  const id = createId();
  await insertVersionRecord(db, {
    id,
    versionNumber,
    mcVersions: parsed.detectedMcVersions,
    loaders: parsed.detectedLoaders,
    changelog: release.body || "",
    releaseChannel: channelFromGithubPrerelease(release.prerelease),
    fileUrl: stored.fileUrl,
    fileName: asset.name,
    fileSize: stored.fileSize,
    fileSha256: stored.fileSha256,
    projectId: project.id,
    // 自動取り込みには実行者がいないため、連携を設定したプロジェクト作者に帰属させる
    uploaderId: project.authorId,
  });

  // updatedAt は posts が持つ（projects 側には無い）
  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  const fullProject = await db.select().from(projects).where(eq(projects.id, project.id)).get();
  if (fullProject) {
    after(async () => {
      await scanVersionFile(db, id, stored.fileUrl, asset.name);
      await notifyNewVersion(db, fullProject, versionNumber);
    });
  }

  revalidatePath(`/projects/${project.slug}`);
  return { success: true, versionId: id, versionNumber };
}

/**
 * 連携している GitHub リポジトリの Release から新しいバージョンを取り込む。
 * releaseId 未指定なら最新の安定版 Release を対象とする。
 * mode が `link` の場合はファイルを保管せず、GitHub の配布 URL を外部リンクとして登録する。
 */
export async function importGithubRelease(
  projectSlug: string,
  releaseId?: number,
  mode: GithubImportMode = "file"
): Promise<ImportResult> {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: "Project not found" };
  await assertProjectAccess(db, project, session);

  const repoToken = await getRepoAccessToken(db, project.authorId, project.githubRepo ?? "");
  return importGithubReleaseSystem(db, project, releaseId, undefined, repoToken, mode);
}
