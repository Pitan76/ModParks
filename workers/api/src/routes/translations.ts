import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as manage from "@modparks/core/translation/manage";
import { requestTranslation, type TranslationDeps } from "@modparks/core/translation/service";
import { requestCommentTranslation } from "@modparks/core/translation/commentService";
import { TRANSLATION_ERROR_STATUS } from "@modparks/core/translation/errorStatus";
import { toTranslationSettings } from "@modparks/core/translation/settings";
import { createWorkersAiProvider } from "@modparks/core/translation/providers/workersAi";
import { readAppSettings } from "@modparks/core/config/readSettings";
import { checkRateLimit, readClientIp } from "@modparks/core/rate-limit";
import type { Database } from "@modparks/core/db/client";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * AI 翻訳（/api/app/translate*, /api/app/projects/:id/translations*）。
 * 以前は Next のルートハンドラ（/api/translate）と Server Action だった。本体は core/translation。
 */

function translationDeps(c: Ctx, db: Database): TranslationDeps {
  const clientIp = readClientIp(c.req.raw.headers);
  return {
    db,
    getSettings: async () => toTranslationSettings(await readAppSettings(c.env.SETTINGS_KV)),
    provider: createWorkersAiProvider(async () => {
      if (!c.env.AI) throw new Error("AI binding not found on modparks-api");
      return c.env.AI;
    }),
    rateLimit: (action, limit, windowMs, userId) => checkRateLimit(db, action, limit, windowMs, userId, clientIp),
  };
}

const noStore = { "Cache-Control": "private, no-store" };

/** 入口なので、壊れた本文は 500 にせず空として扱う */
const readJson = <T>(c: Ctx) => c.req.json<Partial<T>>().catch(() => ({} as Partial<T>));

type ViewerBody = { postId: unknown; commentId: unknown; locale: unknown };

/** POST /api/app/translate — 閲覧者主導の翻訳。本文は { postId, locale }（/api/translate と同じ） */
export async function postTranslate(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return c.json({ error: "unauthorized" }, 401);

  const { postId, locale } = await readJson<ViewerBody>(c);
  if (typeof postId !== "string" || !postId || typeof locale !== "string") return c.json({ error: "invalid_request" }, 400);

  const result = await requestTranslation(translationDeps(c, auth.db), postId, locale, auth.userId);
  if (!result.ok) return c.json({ error: result.error }, TRANSLATION_ERROR_STATUS[result.error] as ContentfulStatusCode, noStore);

  const { title, body, bodyFormat, cached } = result;
  return c.json({ title, body, bodyFormat, cached }, 200, noStore);
}

/** POST /api/app/translate/comment — コメントの翻訳。本文は { commentId, locale } */
export async function postTranslateComment(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return c.json({ error: "unauthorized" }, 401);

  const { commentId, locale } = await readJson<ViewerBody>(c);
  if (typeof commentId !== "string" || !commentId || typeof locale !== "string") return c.json({ error: "invalid_request" }, 400);

  const result = await requestCommentTranslation(translationDeps(c, auth.db), commentId, locale, auth.userId);
  if (!result.ok) return c.json({ error: result.error }, TRANSLATION_ERROR_STATUS[result.error] as ContentfulStatusCode, noStore);

  const { body, bodyFormat, cached } = result;
  return c.json({ body, bodyFormat, cached }, 200, noStore);
}

/** GET /api/app/projects/:id/translations — 編集画面の訳文一覧 */
export async function getProjectTranslations(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return c.json(await manage.listProjectTranslations(auth.db, auth.userId, c.req.param("id")!), 200, noStore);
}

/** PUT /api/app/projects/:id/translations/:locale — 訳文の確定。本文は { title, body } */
export async function putProjectTranslation(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { title, body } = await readJson<{ title: unknown; body: unknown }>(c);
  if (typeof title !== "string" || typeof body !== "string") return c.json({ error: "invalid_request" }, 400);

  await manage.saveManualTranslation(auth.db, auth.userId, c.req.param("id")!, c.req.param("locale")!, title, body);
  return c.body(null, 204);
}

/** DELETE /api/app/projects/:id/translations/:locale — 手動訳の取り下げ */
export async function deleteProjectTranslation(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  await manage.removeTranslation(auth.db, auth.userId, c.req.param("id")!, c.req.param("locale")!);
  return c.body(null, 204);
}

/** POST /api/app/projects/:id/translations/:locale/draft — AI 下書き（保存しない） */
export async function postTranslationDraft(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const result = await manage.draftTranslation(translationDeps(c, auth.db), auth.userId, c.req.param("id")!, c.req.param("locale")!);
  return c.json(result, 200, noStore);
}
