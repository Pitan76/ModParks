import type { Context } from "hono";
import * as ideas from "@modparks/core/ideas/ideas";
import * as ideaComments from "@modparks/core/ideas/comments";
import { togglePostFavorite } from "@modparks/core/posts/favorite";
import { isFeatureAvailable, readRuntimeConfig } from "@modparks/core/runtime/config";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { serverErrorsFor } from "../serverErrors";
import { respond, userNotifyContextFor } from "../appContext";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * idea・コメント・お気に入りの操作（/api/app/*）。以前は Server Action だった。
 *
 * 本体は core にあり、Server Action と同じものが動く。ここは入口として
 * 認証（セッション）・機能停止の判定・結果の変換だけを担う。
 * キャッシュの無効化（revalidatePath）はしない。対象ページは layout が動的 API を
 * 使うため Full Route Cache が無く、Next 側でも実質効いていなかった。
 */

/** POST /api/app/ideas */
export async function postIdea(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await ideas.createIdea({ db: auth.db, t: serverErrorsFor(c.req.raw) }, auth.userId, await c.req.formData()));
}

/** PATCH /api/app/ideas/:id */
export async function patchIdea(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { db: auth.db, t: serverErrorsFor(c.req.raw) };

  return respond(c, await ideas.updateIdea(deps, auth.userId, c.req.param("id")!, await c.req.formData()));
}

/** PATCH /api/app/ideas/:id/status — 本文は { status } */
export async function patchIdeaStatus(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  // 入口なので、壊れた本文は 500 にせず「状態が不正」として core に判定させる
  const body = await c.req.json<{ status?: unknown }>().catch(() => ({} as { status?: unknown }));
  const status = typeof body.status === "string" ? body.status : "";
  const deps = { db: auth.db, t: serverErrorsFor(c.req.raw) };

  return respond(c, await ideas.updateIdeaStatus(deps, auth.userId, c.req.param("id")!, status));
}

/** DELETE /api/app/ideas/:id */
export async function deleteIdea(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await ideas.deleteIdea({ db: auth.db, t: serverErrorsFor(c.req.raw) }, auth.userId, c.req.param("id")!));
}

/** POST /api/app/posts/:id/favorite — プロジェクト・アイデア共通 */
export async function postFavorite(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { notify: userNotifyContextFor(c, auth.db), t: serverErrorsFor(c.req.raw) };

  return respond(c, await togglePostFavorite(deps, auth.userId, c.req.param("id")!));
}

/** POST /api/app/ideas/:id/comments */
export async function postIdeaComment(c: Ctx) {
  // 機能停止の判定は入口で行う（Server Action の assertFeatureEnabled と同じく認証より前）
  if (!isFeatureAvailable(await readRuntimeConfig(c.env.SETTINGS_KV), "comment")) {
    return c.json({ error: "feature_disabled", feature: "comment" }, 503);
  }

  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { notify: userNotifyContextFor(c, auth.db), t: serverErrorsFor(c.req.raw) };

  return respond(c, await ideaComments.createIdeaComment(deps, auth.userId, c.req.param("id")!, await c.req.formData()));
}

/** PATCH /api/app/idea-comments/:id */
export async function patchIdeaComment(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { notify: userNotifyContextFor(c, auth.db), t: serverErrorsFor(c.req.raw) };

  return respond(c, await ideaComments.updateIdeaComment(deps, auth.userId, c.req.param("id")!, await c.req.formData()));
}

/** DELETE /api/app/idea-comments/:id */
export async function deleteIdeaComment(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { notify: userNotifyContextFor(c, auth.db), t: serverErrorsFor(c.req.raw) };

  return respond(c, await ideaComments.deleteIdeaComment(deps, auth.userId, c.req.param("id")!));
}
