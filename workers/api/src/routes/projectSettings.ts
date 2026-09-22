import type { Context } from "hono";
import * as settings from "@modparks/core/projects/projectSettings";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { respond } from "../appContext";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * プロジェクトの説明・アイコン・所有権の譲渡（/api/app/projects/:id/*）。以前は Server Action だった。
 * 本体は core/projects/projectSettings.ts。見つからない・権限なしは core が例外にし、
 * Server Action のときと同じく画面側には失敗として届く。
 */

/** 入口なので、壊れた本文は 500 にせず空として扱う */
const readJson = <T>(c: Ctx) => c.req.json<Partial<T>>().catch(() => ({} as Partial<T>));

/** PATCH /api/app/projects/:id/description */
export async function patchDescription(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await settings.updateProjectDescription(auth.db, auth.userId, c.req.param("id")!, await c.req.formData()));
}

/** PATCH /api/app/projects/:id/icon — 本文は { iconUrl } */
export async function patchIcon(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { iconUrl } = await readJson<{ iconUrl: unknown }>(c);
  if (typeof iconUrl !== "string") return c.json({ error: "invalid_request" }, 400);

  return respond(c, await settings.updateProjectIcon(auth.db, auth.userId, c.req.param("id")!, iconUrl));
}

/** POST /api/app/projects/:id/transfer — 本文は { newOwnerId } */
export async function postTransfer(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { newOwnerId } = await readJson<{ newOwnerId: unknown }>(c);
  if (typeof newOwnerId !== "string" || !newOwnerId.trim()) return c.json({ error: "invalid_request" }, 400);

  return respond(c, await settings.transferOwnership(auth.db, auth.userId, c.req.param("id")!, newOwnerId.trim()));
}
