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
import {
  fetchGithubReleases,
  fetchLatestGithubRelease,
  pickPrimaryAsset,
  downloadGithubAsset,
  normalizeGithubRepo,
  type GithubRelease,
} from "@/lib/utils/github";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { getRepoAccessToken } from "@/lib/utils/githubRepoAccess";

/** Worker のメモリ制約を踏まえたダウンロード/解析の上限 */
const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB

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

/**
 * 内部システム用のインポート関数（セッション・権限チェックなし）。Webhook等から使用する。
 */
export async function importGithubReleaseSystem(
  db: any,
  project: { id: string; slug: string; githubRepo: string | null },
  releaseId?: number,
  prefetchedRelease?: GithubRelease | null,
  /** 非公開リポジトリを扱う場合に必要な GitHub App の installation token */
  repoToken?: string
): Promise<{ success: true; versionId: string; versionNumber: string } | { error: string }> {
  const repo = project.githubRepo ? normalizeGithubRepo(project.githubRepo) : null;
  if (!repo) return { error: "No valid GitHub repository linked to this project." };

  // 対象 Release を決定
  let release: GithubRelease | null = null;
  try {
    if (prefetchedRelease !== undefined) {
      release = prefetchedRelease;
    } else if (releaseId != null) {
      const all = await fetchGithubReleases(repo, repoToken);
      release = all.find((r) => r.id === releaseId) ?? null;
    } else {
      release = await fetchLatestGithubRelease(repo, repoToken);
    }
  } catch (e: any) {
    return { error: e?.message || "Failed to fetch GitHub release." };
  }
  if (!release) return { error: "No release found in the linked repository." };

  const asset = pickPrimaryAsset(release);
  if (!asset) return { error: "No downloadable .jar/.zip asset found in the release." };
  if (asset.size > MAX_ASSET_SIZE) {
    return { error: `Asset is too large to import (max ${MAX_ASSET_SIZE / 1024 / 1024}MB).` };
  }

  // ダウンロード
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await downloadGithubAsset(asset, repoToken);
  } catch (e: any) {
    return { error: e?.message || "Failed to download release asset." };
  }

  // R2 へアップロード。
  // 解析より先に置くのは、非公開リポジトリのアセット URL を jar Worker 側から
  // 取得できない（トークンを持たない）ため。R2 キー経由なら公開/非公開を問わず解析できる。
  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = buildR2Key("mod", project.slug, `${createId()}/${safeFileName}`);
  const contentType = asset.name.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/java-archive";

  let fileSha256 = "";
  try {
    fileSha256 = await sha256Hex(arrayBuffer);
    const bucket = await getR2Bucket();
    await uploadToR2(bucket, key, arrayBuffer, contentType);
  } catch (e: any) {
    return { error: e?.message || "Failed to store the release file." };
  }

  // 解析。Service Binding 越しに巨大なバイト列を渡さず、R2 キーを渡して Worker 側に取得させる
  let parsed = { detectedVersion: "", detectedLoaders: [] as string[], detectedMcVersions: [] as string[] };
  try {
    parsed = await parseModJar({ kind: "r2", key });
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
    try {
      await deleteFromR2(await getR2Bucket(), key);
    } catch (e: unknown) {
      console.error("Failed to clean up R2 object after duplicate version:", e);
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
    fileUrl: getR2PublicUrl(key),
    fileName: asset.name,
    fileSize: asset.size,
    fileSha256,
    projectId: project.id,
  });

  // updatedAt は posts が持つ（projects 側には無い）
  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  const fullProject = await db.select().from(projects).where(eq(projects.id, project.id)).get();
  if (fullProject) {
    after(async () => {
      await scanVersionFile(db, id, getR2PublicUrl(key), asset.name);
      await notifyNewVersion(db, fullProject, versionNumber);
    });
  }

  revalidatePath(`/projects/${project.slug}`);
  return { success: true, versionId: id, versionNumber };
}

/**
 * 連携している GitHub リポジトリの Release から新しいバージョンを取り込む。
 * releaseId 未指定なら最新の安定版 Release を対象とする。
 */
export async function importGithubRelease(
  projectSlug: string,
  releaseId?: number
): Promise<{ success: true; versionId: string; versionNumber: string } | { error: string }> {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: "Project not found" };
  await assertProjectAccess(db, project, session);

  const repoToken = await getRepoAccessToken(db, project.authorId, project.githubRepo ?? "");
  return importGithubReleaseSystem(db, project, releaseId, undefined, repoToken);
}
