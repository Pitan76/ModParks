"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { projects, versions } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildR2Key, getR2PublicUrl, getR2Bucket, uploadToR2 } from "@/lib/r2";
import { insertVersionRecord } from "@/lib/utils/versionRecord";
import { parseModJar } from "@/lib/utils/modParser";
import {
  fetchGithubReleases,
  fetchLatestGithubRelease,
  pickPrimaryAsset,
  downloadGithubAsset,
  normalizeGithubRepo,
  type GithubRelease,
} from "@/lib/utils/github";

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
    const project = await db.select().from(projects).where(eq(projects.slug, projectSlug)).get();
    if (!project) return { error: "Project not found" };
    await assertProjectAccess(db, project, session);
    if (!project.githubRepo) return { error: "No GitHub repository linked to this project." };

    const releases = await fetchGithubReleases(project.githubRepo);
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
 * 連携している GitHub リポジトリの Release から新しいバージョンを取り込む。
 * releaseId 未指定なら最新の安定版 Release を対象とする。
 */
export async function importGithubRelease(
  projectSlug: string,
  releaseId?: number
): Promise<{ success: true; versionId: string; versionNumber: string } | { error: string }> {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.slug, projectSlug)).get();
  if (!project) return { error: "Project not found" };
  await assertProjectAccess(db, project, session);

  const repo = project.githubRepo ? normalizeGithubRepo(project.githubRepo) : null;
  if (!repo) return { error: "No valid GitHub repository linked to this project." };

  // 対象 Release を決定
  let release: GithubRelease | null;
  try {
    if (releaseId != null) {
      const all = await fetchGithubReleases(repo);
      release = all.find((r) => r.id === releaseId) ?? null;
    } else {
      release = await fetchLatestGithubRelease(repo);
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

  // ダウンロード → 解析
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await downloadGithubAsset(asset);
  } catch (e: any) {
    return { error: e?.message || "Failed to download release asset." };
  }

  let parsed = { detectedVersion: "", detectedLoaders: [] as string[], detectedMcVersions: [] as string[] };
  try {
    parsed = await parseModJar(arrayBuffer);
  } catch {
    // 解析失敗時はタグ名などのフォールバックで続行
  }

  const versionNumber = parsed.detectedVersion || stripVPrefix(release.tag_name) || release.tag_name;

  // 重複チェック（同一プロジェクトで同じバージョン番号が既にある）
  const existing = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(eq(versions.projectId, project.id), eq(versions.versionNumber, versionNumber)))
    .get();
  if (existing) {
    return { error: `Version '${versionNumber}' has already been imported.` };
  }

  // R2 へアップロード
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

  const id = createId();
  await insertVersionRecord(db, {
    id,
    versionNumber,
    mcVersions: parsed.detectedMcVersions,
    loaders: parsed.detectedLoaders,
    changelog: release.body || "",
    fileUrl: getR2PublicUrl(key),
    fileName: asset.name,
    fileSize: asset.size,
    fileSha256,
    projectId: project.id,
  });

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id)).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true, versionId: id, versionNumber };
}
