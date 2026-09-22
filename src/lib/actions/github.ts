"use server";

import * as core from "@modparks/core/versions/githubImport";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getR2Bucket } from "@/lib/r2";
import { nextScanContext } from "@/lib/actions/versionScan";
import { nextGithubCredentials } from "@/lib/utils/githubCredentials";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { GithubImportMode } from "@modparks/core/utils/github";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

/**
 * GitHub Release からの取り込み（Server Action）。本体は core/versions/githubImport.ts。
 * Webhook は core の importGithubReleaseSystem を直接呼ぶ（db を受け取る関数を Server Action として公開しないため）。
 */

/** 連携リポジトリの Release 一覧を取得する（UI プレビュー用） */
export async function listGithubReleases(projectSlug: string) {
  const { db, session } = await getAuthenticatedDb();
  const deps = { db, t: await getServerErrors(), github: nextGithubCredentials() };

  return core.listGithubReleases(deps, session.user.id, projectSlug);
}

/**
 * 連携している GitHub リポジトリの Release から新しいバージョンを取り込む。
 * releaseId 未指定なら最新の安定版 Release を対象とする。
 */
export async function importGithubRelease(projectSlug: string, releaseId?: number, mode?: GithubImportMode) {
  const { db, session } = await getAuthenticatedDb();
  const deps: core.GithubImportDeps = {
    scan: await nextScanContext(db),
    t: await getServerErrors(),
    github: nextGithubCredentials(),
    getBucket: getR2Bucket,
    defer: (task) => after(task),
  };

  const result = await core.importGithubRelease(deps, session.user.id, projectSlug, releaseId, mode);
  if ("success" in result) revalidatePath(`/projects/${projectSlug}`);

  return result;
}
