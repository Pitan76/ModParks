import type * as manage from "@modparks/core/versions/manage";
import type { BatchAddMcVersionData } from "@modparks/core/versions/batch";
import type * as githubImport from "@modparks/core/versions/githubImport";
import type * as recipes from "@modparks/core/versions/recipes";
import type { GithubImportMode } from "@modparks/core/utils/github";
import type { ActionResult } from "@modparks/core/actionResult";
import { sendAppAction } from "@/lib/http/appApi";

/**
 * バージョンの操作（ブラウザ側）。modparks-api の /api/app/projects/:slug/versions/* を呼ぶ。
 *
 * 以前の Server Action（lib/actions/version.ts・versionLifecycle.ts・versionBatch.ts）と
 * 同じ名前・引数・戻り値にしてあり、画面側は import 先を変えるだけで済む（ideaApi.ts と同じ）。
 */
type Result<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

const base = (projectSlug: string) => `/api/app/projects/${encodeURIComponent(projectSlug)}/versions`;
const one = (projectSlug: string, versionId: string) => `${base(projectSlug)}/${encodeURIComponent(versionId)}`;

export const createVersion = (projectSlug: string, formData: FormData) =>
  sendAppAction<Result<typeof manage.createVersion>>(base(projectSlug), "POST", formData);

export const updateVersion = (versionId: string, projectSlug: string, formData: FormData) =>
  sendAppAction<Result<typeof manage.updateVersion>>(one(projectSlug, versionId), "PATCH", formData);

export const deleteVersion = (versionId: string, projectSlug: string) =>
  sendAppAction<ActionResult>(one(projectSlug, versionId), "DELETE");

export const setVersionArchived = (versionId: string, projectSlug: string, archived: boolean) =>
  sendAppAction<ActionResult>(`${one(projectSlug, versionId)}/archive`, "PATCH", { archived });

export const batchAddMcVersion = (
  projectSlug: string,
  versionIds: string[],
  mcVersions: string[],
  syncModrinth: boolean,
  syncCurseforge: boolean,
) =>
  sendAppAction<ActionResult<BatchAddMcVersionData>>(`${base(projectSlug)}/batch-mc-versions`, "POST", {
    versionIds, mcVersions, syncModrinth, syncCurseforge,
  });

/** 連携している GitHub リポジトリの Release から取り込む。releaseId 未指定なら最新の安定版 */
export const importGithubRelease = (projectSlug: string, releaseId?: number, mode?: GithubImportMode) =>
  sendAppAction<Result<typeof githubImport.importGithubRelease>>(
    `/api/app/projects/${encodeURIComponent(projectSlug)}/github-import`, "POST", { releaseId, mode },
  );

type RecipeResult = { success: true; count: number } | { error: string };

/** jar Worker でレシピを抽出する */
export const extractRecipesFromVersion = (versionId: string, projectSlug: string) =>
  sendAppAction<RecipeResult>(`${one(projectSlug, versionId)}/recipes`, "POST");

/** ブラウザで抽出したレシピを CDN へ中継する */
export const uploadClientExtractedRecipes = (
  versionId: string,
  projectSlug: string,
  byNs: Parameters<typeof recipes.uploadClientExtractedRecipes>[4],
) => sendAppAction<RecipeResult>(`${one(projectSlug, versionId)}/recipes/upload`, "POST", { byNs });
