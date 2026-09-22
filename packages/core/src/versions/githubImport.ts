import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "@modparks/core/db/client";
import { posts, projects, versions } from "@modparks/core/db/schema";
import { deleteFromR2 } from "@modparks/core/r2";
import { insertVersionRecord } from "@modparks/core/utils/versionRecord";
import { notifyNewVersion } from "@modparks/core/notifications/dispatch";
import { channelFromGithubPrerelease } from "@modparks/core/releaseChannels";
import {
  fetchGithubReleases,
  pickPrimaryAssets,
  normalizeGithubRepo,
  type GithubRelease,
  type GithubReleaseAsset,
  type GithubImportMode,
  type GithubServerToken,
} from "@modparks/core/utils/github";
import { stripVPrefix, resolveRelease, storeAssetToR2, linkToAsset, type ImportedFile } from "@modparks/core/github/releaseAsset";
import { getRepoAccessToken } from "@modparks/core/github/repoAccess";
import type { GithubAppConfig } from "@modparks/core/github/app";
import { findProjectPostBySlug } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { scanVersionFile, type VersionScanContext } from "@modparks/core/versions/scan";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * GitHub Release からのバージョン取り込みの本体。
 * 画面（Next の Server Action / modparks-api）と Webhook の両方から呼ぶ。
 * キャッシュの無効化は呼び出し側で行う。
 */

/** GitHub への認証に要る秘密値。呼び出し側が環境から取って渡す */
export type GithubCredentials = {
  /** 公開リポジトリの読み取り用（GITHUB_TOKEN）。レート制限を緩めるため */
  serverToken: GithubServerToken;
  /** 非公開リポジトリ用の GitHub App。未設定なら null */
  app: GithubAppConfig | null;
};

export type GithubImportDeps = {
  /** 検査・通知に要る部品一式。db もここ（scan.notify.db）から取る */
  scan: VersionScanContext;
  t: ServerErrorTranslator;
  github: GithubCredentials;
  getBucket: () => Promise<R2Bucket>;
  /** 応答後に回す処理を預ける（manage.ts の VersionDeps と同じ） */
  defer: (task: () => Promise<void>) => void;
};

type ImportResult = { success: true; versionId: string; versionNumber: string } | { error: string };

type ImportTarget = { id: string; slug: string; githubRepo: string | null; authorId: string; githubReleaseImportMode?: string | null };

type ParsedJar = { detectedVersion: string; detectedLoaders: string[]; detectedMcVersions: string[] };

/** 編集権限のあるプロジェクトを取る */
async function loadEditableProject(db: Database, t: ServerErrorTranslator, projectSlug: string, userId: string) {
  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: t("project.notFound") };
  if (!(await canEditProject(db, project, userId))) return { error: t("common.forbidden") };

  return { project };
}

/** 連携リポジトリの Release 一覧を取得する（UI プレビュー用） */
export async function listGithubReleases(
  deps: { db: Database; t: ServerErrorTranslator; github: GithubCredentials },
  userId: string,
  projectSlug: string,
): Promise<{ success: true; releases: Pick<GithubRelease, "id" | "tag_name" | "name" | "prerelease" | "published_at">[] } | { error: string }> {
  const { db, t, github } = deps;
  const loaded = await loadEditableProject(db, t, projectSlug, userId);
  if (!loaded.project) return { error: loaded.error };
  const { project } = loaded;
  if (!project.githubRepo) return { error: t("github.notLinked") };

  // GitHub は外部I/O境界。取得の失敗は画面に出す文言として返す
  try {
    // 非公開リポジトリは、本人がインストールした GitHub App のトークンでのみ読める
    const repoToken = await getRepoAccessToken(db, github.app, project.authorId, project.githubRepo);
    const releases = await fetchGithubReleases(project.githubRepo, repoToken, github.serverToken);
    return {
      success: true,
      releases: releases.map(({ id, tag_name, name, prerelease, published_at }) => ({ id, tag_name, name, prerelease, published_at })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to list releases." };
  }
}

/** 解析に失敗してもタグ名などで続行するので、失敗は空の結果として返す */
async function parseAsset(scan: VersionScanContext, stored: ImportedFile): Promise<{ parsed: ParsedJar; failed: boolean }> {
  try {
    const parsed = await scan.jar.parseModJar(stored.r2Key ? { kind: "r2", key: stored.r2Key } : { kind: "url", url: stored.fileUrl });
    return { parsed, failed: false };
  } catch {
    return { parsed: { detectedVersion: "", detectedLoaders: [], detectedMcVersions: [] }, failed: true };
  }
}

/** 1 つの Release に複数のアセットがあるときは、ローダー名を付けて番号を分ける */
function loaderSuffixFor(asset: GithubReleaseAsset, parsed: ParsedJar, parseFailed: boolean): string {
  if (!parseFailed && parsed.detectedLoaders.length === 1) return parsed.detectedLoaders[0].toLowerCase();

  const nameLower = asset.name.toLowerCase();
  if (nameLower.includes("fabric")) return "fabric";
  if (nameLower.includes("forge")) return "forge";
  if (nameLower.includes("neoforge")) return "neoforge";
  if (nameLower.includes("quilt")) return "quilt";
  return "";
}

/** 置いたばかりのオブジェクトを片付ける。失敗しても取り込みの結果は変えない */
async function discardStored(deps: GithubImportDeps, stored: ImportedFile) {
  if (!stored.r2Key) return;
  try {
    await deleteFromR2(await deps.getBucket(), stored.r2Key);
  } catch (e: unknown) {
    console.error("Failed to clean up R2 object after duplicate version:", e);
  }
}

/** 通知は projects 側（アイコン・Webhook）と posts 側（タイトル）の双方を必要とする */
function loadNotifyTarget(db: Database, projectId: string) {
  return db
    .select({
      id: projects.id,
      iconUrl: projects.iconUrl,
      discordWebhookUrl: projects.discordWebhookUrl,
      title: posts.title,
      slug: posts.slug,
      authorId: posts.authorId,
    })
    .from(projects)
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(projects.id, projectId))
    .get();
}

type AssetContext = { project: ImportTarget; release: GithubRelease; assetCount: number; mode: GithubImportMode; repoToken?: string };

/** アセット 1 つをバージョンとして登録する */
async function importAsset(deps: GithubImportDeps, ctx: AssetContext, asset: GithubReleaseAsset): Promise<{ id: string; versionNumber: string } | { error: string }> {
  const { scan, github } = deps;
  const { db } = scan.notify;
  const { project, release } = ctx;

  // R2 へのアップロードを解析より先に行うのは、非公開リポジトリのアセット URL を
  // jar Worker 側から取得できない（トークンを持たない）ため。
  // R2 キー経由なら公開/非公開を問わず解析できる。
  const storage = { getBucket: deps.getBucket, publicUrl: scan.r2PublicUrl };
  const stored = ctx.mode === "link"
    ? linkToAsset(asset)
    : await storeAssetToR2(storage, project.slug, asset, ctx.repoToken, github.serverToken);
  if ("error" in stored) return stored;

  // 解析。Service Binding 越しに巨大なバイト列を渡さず、所在だけを Worker に渡す
  const { parsed, failed } = await parseAsset(scan, stored);
  const baseVersion = parsed.detectedVersion || stripVPrefix(release.tag_name) || release.tag_name;
  const suffix = ctx.assetCount > 1 ? loaderSuffixFor(asset, parsed, failed) : "";
  const versionNumber = suffix ? `${baseVersion}-${suffix}` : baseVersion;

  // バージョン番号は解析結果に依存するためアップロード後にしか重複を判定できず、
  // 重複だった場合は置いたばかりのオブジェクトを消してから戻る。
  const existing = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(eq(versions.projectId, project.id), eq(versions.versionNumber, versionNumber)))
    .get();
  if (existing) {
    await discardStored(deps, stored);
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

  const notifyTarget = await loadNotifyTarget(db, project.id);
  if (notifyTarget) {
    deps.defer(async () => {
      await scanVersionFile(scan, id, stored.fileUrl, asset.name);
      await notifyNewVersion(scan.notify, notifyTarget, versionNumber);
    });
  }

  return { id, versionNumber };
}

/**
 * 内部システム用のインポート関数（セッション・権限チェックなし）。Webhook等から使用する。
 * @param prefetchedRelease 取得済みの Release。undefined なら取りに行き、null は「Release 無し」
 * @param repoToken 非公開リポジトリを扱う場合に必要な GitHub App の installation token
 */
export async function importGithubReleaseSystem(
  deps: GithubImportDeps,
  project: ImportTarget,
  releaseId?: number,
  prefetchedRelease?: GithubRelease | null,
  repoToken?: string,
  mode?: GithubImportMode
): Promise<ImportResult> {
  const { t } = deps;
  const repo = project.githubRepo ? normalizeGithubRepo(project.githubRepo) : null;
  if (!repo) return { error: t("github.invalidRepo") };

  let release: GithubRelease | null;
  try {
    release = await resolveRelease(repo, releaseId, prefetchedRelease, repoToken, deps.github.serverToken);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to fetch GitHub release." };
  }
  if (!release) return { error: t("github.releaseNotFound") };

  const assets = pickPrimaryAssets(release);
  if (assets.length === 0) return { error: t("github.assetNotFound") };

  const ctx: AssetContext = {
    project, release, repoToken, assetCount: assets.length,
    mode: mode ?? (project.githubReleaseImportMode as GithubImportMode) ?? "link",
  };
  const imported: { id: string; versionNumber: string }[] = [];
  let lastError = "";
  for (const asset of assets) {
    const result = await importAsset(deps, ctx, asset);
    if ("error" in result) lastError = result.error;
    else imported.push(result);
  }

  if (imported.length === 0) return { error: lastError || "No assets were imported." };

  // updatedAt は posts が持つ（projects 側には無い）
  await deps.scan.notify.db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  return { success: true, versionId: imported[imported.length - 1].id, versionNumber: imported.map((v) => v.versionNumber).join(", ") };
}

/**
 * 連携している GitHub リポジトリの Release から新しいバージョンを取り込む。
 * releaseId 未指定なら最新の安定版 Release を対象とする。
 * mode が `link` の場合はファイルを保管せず、GitHub の配布 URL を外部リンクとして登録する。
 */
export async function importGithubRelease(
  deps: GithubImportDeps,
  userId: string,
  projectSlug: string,
  releaseId?: number,
  mode?: GithubImportMode
): Promise<ImportResult> {
  const { db } = deps.scan.notify;
  const loaded = await loadEditableProject(db, deps.t, projectSlug, userId);
  if (!loaded.project) return { error: loaded.error };

  const repoToken = await getRepoAccessToken(db, deps.github.app, loaded.project.authorId, loaded.project.githubRepo ?? "");
  return importGithubReleaseSystem(deps, loaded.project, releaseId, undefined, repoToken, mode);
}
