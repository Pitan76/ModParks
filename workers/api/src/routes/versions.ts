import type { Context } from "hono";
import * as manage from "@modparks/core/versions/manage";
import * as lifecycle from "@modparks/core/versions/lifecycle";
import * as batch from "@modparks/core/versions/batch";
import * as githubImport from "@modparks/core/versions/githubImport";
import { githubAppConfig } from "@modparks/core/github/app";
import type { GithubImportMode } from "@modparks/core/utils/github";
import { createJarClient } from "@modparks/core/jar/client";
import { isFeatureAvailable, readRuntimeConfig } from "@modparks/core/runtime/config";
import type { Database } from "@modparks/core/db/client";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { serverErrorsFor } from "../serverErrors";
import { respond, userNotifyContextFor } from "../appContext";
import { systemCommentMessage } from "../notificationMessage";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * バージョンの作成・編集・削除・アーカイブ・一括追加（/api/app/projects/:slug/versions/*）。
 * 以前は Server Action だった。本体は core/versions にあり、ここは入口として
 * 認証・機能停止の判定・環境の部品の受け渡しだけを担う（routes/ideas.ts と同じ）。
 */

async function featureAvailable(c: Ctx, feature: "upload" | "jarAnalysis") {
  return isFeatureAvailable(await readRuntimeConfig(c.env.SETTINGS_KV), feature);
}

function versionDeps(c: Ctx, db: Database): manage.VersionDeps {
  return {
    scan: {
      notify: userNotifyContextFor(c, db),
      jar: createJarClient(async () => c.env.JAR),
      r2PublicUrl: c.env.R2_PUBLIC_URL,
      isAnalysisEnabled: () => featureAvailable(c, "jarAnalysis"),
      adminWebhookUrl: c.env.DISCORD_WEBHOOK_URL,
    },
    t: serverErrorsFor(c.req.raw),
    systemComment: systemCommentMessage,
    // 検査は jar Worker の往復で遅いので応答を待たせない。預けないと応答後に打ち切られうる
    defer: (task) => c.executionCtx.waitUntil(task()),
  };
}

function lifecycleDeps(c: Ctx, db: Database): lifecycle.VersionLifecycleDeps {
  return {
    db,
    t: serverErrorsFor(c.req.raw),
    r2PublicUrl: c.env.R2_PUBLIC_URL,
    getBucket: async () => c.env.modparks_storage,
  };
}

/** 入口なので、壊れた本文は 500 にせず空として core に判定させる */
const readJson = <T>(c: Ctx) => c.req.json<Partial<T>>().catch(() => ({} as Partial<T>));

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** POST /api/app/projects/:slug/versions */
export async function postVersion(c: Ctx) {
  // 機能停止の判定は認証より前（Server Action の assertFeatureEnabled と同じ）
  if (!(await featureAvailable(c, "upload"))) return c.json({ error: "feature_disabled", feature: "upload" }, 503);

  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await manage.createVersion(versionDeps(c, auth.db), auth.userId, c.req.param("slug")!, await c.req.formData()));
}

/** PATCH /api/app/projects/:slug/versions/:id */
export async function patchVersion(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = versionDeps(c, auth.db);

  return respond(c, await manage.updateVersion(deps, auth.userId, c.req.param("id")!, c.req.param("slug")!, await c.req.formData()));
}

/** DELETE /api/app/projects/:slug/versions/:id */
export async function deleteVersion(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await lifecycle.deleteVersion(lifecycleDeps(c, auth.db), auth.userId, c.req.param("id")!, c.req.param("slug")!));
}

/** PATCH /api/app/projects/:slug/versions/:id/archive — 本文は { archived } */
export async function patchVersionArchive(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ archived: unknown }>(c);
  const deps = lifecycleDeps(c, auth.db);

  return respond(c, await lifecycle.setVersionArchived(deps, auth.userId, c.req.param("id")!, c.req.param("slug")!, body.archived === true));
}

type BatchBody = { versionIds: unknown; mcVersions: unknown; syncModrinth: unknown; syncCurseforge: unknown };

/** POST /api/app/projects/:slug/versions/batch-mc-versions */
export async function postBatchMcVersions(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const body = await readJson<BatchBody>(c);
  const deps = { db: auth.db, t: serverErrorsFor(c.req.raw) };

  return respond(c, await batch.batchAddMcVersion(
    deps, auth.userId, c.req.param("slug")!,
    stringList(body.versionIds), stringList(body.mcVersions),
    body.syncModrinth === true, body.syncCurseforge === true,
  ));
}

type ImportBody = { releaseId: unknown; mode: unknown };

/** POST /api/app/projects/:slug/github-import — 本文は { releaseId?, mode? } */
export async function postGithubImport(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const body = await readJson<ImportBody>(c);
  const releaseId = typeof body.releaseId === "number" ? body.releaseId : undefined;
  const mode = body.mode === "file" || body.mode === "link" ? (body.mode as GithubImportMode) : undefined;
  const { scan, t, defer } = versionDeps(c, auth.db);
  const deps: githubImport.GithubImportDeps = {
    scan, t, defer,
    github: { serverToken: c.env.GITHUB_TOKEN, app: githubAppConfig(c.env.GITHUB_APP_ID, c.env.GITHUB_APP_PRIVATE_KEY) },
    getBucket: async () => c.env.modparks_storage,
  };

  return respond(c, await githubImport.importGithubRelease(deps, auth.userId, c.req.param("slug")!, releaseId, mode));
}
