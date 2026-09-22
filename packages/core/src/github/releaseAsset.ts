/**
 * GitHub Release のアセットを modparks のバージョンとして取り込むための下請け。
 *
 * 取り込み本体（versions/githubImport.ts）から分けているのは、ここが
 * 「どの Release を選ぶか」「ファイルをどこに置くか」だけを扱い、
 * 権限確認や DB 書き込みを持たないため。
 */
import { createId } from "@paralleldrive/cuid2";
import { buildR2Key, r2PublicUrl, uploadToR2 } from "@modparks/core/r2";
import { isAllowedExternalUrl } from "@modparks/core/validations";
import {
  fetchGithubReleases,
  fetchLatestGithubRelease,
  downloadGithubAsset,
  type GithubRelease,
  type GithubReleaseAsset,
  type GithubServerToken,
} from "@modparks/core/utils/github";

/** 取り込み先の R2。束縛は環境から取るものなので呼び出し側が渡す */
export type AssetStorage = { getBucket: () => Promise<R2Bucket>; publicUrl: string | undefined };

/** Worker のメモリ制約を踏まえたダウンロード/解析の上限 */
export const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB

/** 取り込んだファイルの所在。R2 に置いた場合のみ key を持つ */
export type ImportedFile = { fileUrl: string; fileSize: number | null; fileSha256: string | null; r2Key?: string };

/** `v1.2.3` のようなタグからバージョン番号部分だけを取り出す */
export function stripVPrefix(tag: string): string {
  return tag.replace(/^v/i, "").trim();
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 取り込み対象の Release を決定する。prefetch 済みならそれを優先する */
export async function resolveRelease(
  repo: string,
  releaseId: number | undefined,
  prefetchedRelease: GithubRelease | null | undefined,
  repoToken: string | undefined,
  serverToken: GithubServerToken
): Promise<GithubRelease | null> {
  if (prefetchedRelease !== undefined) return prefetchedRelease;
  if (releaseId != null) {
    const all = await fetchGithubReleases(repo, repoToken, serverToken);
    return all.find((r) => r.id === releaseId) ?? null;
  }
  return fetchLatestGithubRelease(repo, repoToken, serverToken);
}

/** アセットをダウンロードして R2 へ格納する */
export async function storeAssetToR2(
  storage: AssetStorage,
  projectSlug: string,
  asset: GithubReleaseAsset,
  repoToken: string | undefined,
  serverToken: GithubServerToken
): Promise<ImportedFile | { error: string }> {
  if (asset.size > MAX_ASSET_SIZE) {
    return { error: `Asset is too large to import (max ${MAX_ASSET_SIZE / 1024 / 1024}MB).` };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await downloadGithubAsset(asset, repoToken, serverToken);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to download release asset." };
  }

  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = buildR2Key("mod", projectSlug, `${createId()}/${safeFileName}`);
  const contentType = asset.name.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/java-archive";

  try {
    const fileSha256 = await sha256Hex(arrayBuffer);
    await uploadToR2(await storage.getBucket(), key, arrayBuffer, contentType);
    return { fileUrl: r2PublicUrl(storage.publicUrl, key), fileSize: asset.size, fileSha256, r2Key: key };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to store the release file." };
  }
}

/**
 * アセットを取り込まず、GitHub の配布 URL をそのまま外部リンクとして使う。
 * 非公開リポジトリの URL は誰も辿れないため、この方式は公開リポジトリ限定。
 */
export function linkToAsset(asset: GithubReleaseAsset): ImportedFile | { error: string } {
  const url = asset.browser_download_url;
  if (!url || !isAllowedExternalUrl(url)) return { error: "The release asset URL is not an allowed external URL." };
  return { fileUrl: url, fileSize: asset.size, fileSha256: null };
}
