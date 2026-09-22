import type { Context } from "hono";
import * as settings from "@modparks/core/projects/projectSettings";
import * as media from "@modparks/core/projects/media";
import * as members from "@modparks/core/projects/members";
import { serverErrorsFor } from "../serverErrors";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { respond } from "../appContext";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * プロジェクトの説明・アイコン・所有権の譲渡・画像・メンバー（/api/app/projects/:id/*, /api/app/media/:id）。以前は Server Action だった。
 * 本体は core/projects/ の projectSettings・media・members。見つからない・権限なしは core が例外にし、
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

/** POST /api/app/projects/:id/media — 本文は { url, caption? } */
export async function postMedia(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { url, caption } = await readJson<{ url: unknown; caption: unknown }>(c);
  if (typeof url !== "string" || !url) return c.json({ error: "invalid_request" }, 400);

  return respond(c, await media.addProjectMedia(auth.db, auth.userId, c.req.param("id")!, url, typeof caption === "string" ? caption : undefined));
}

/** PATCH /api/app/media/:id — 本文は { featured } */
export async function patchMedia(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { featured } = await readJson<{ featured: unknown }>(c);

  return respond(c, await media.toggleMediaFeatured(auth.db, auth.userId, c.req.param("id")!, featured === true));
}

/** DELETE /api/app/media/:id */
export async function deleteMedia(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const storage = { r2PublicUrl: c.env.R2_PUBLIC_URL, getBucket: async () => c.env.modparks_storage };

  return respond(c, await media.deleteProjectMedia(auth.db, storage, auth.userId, c.req.param("id")!));
}

/** POST /api/app/projects/:id/members — 本文は { username } */
export async function postMember(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const { username } = await readJson<{ username: unknown }>(c);
  if (typeof username !== "string" || !username.trim()) return c.json({ error: "invalid_request" }, 400);

  return respond(c, await members.addProjectMember(auth.db, serverErrorsFor(c.req.raw), auth.userId, c.req.param("id")!, username.trim()));
}

/** DELETE /api/app/projects/:id/members/:userId */
export async function deleteMember(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return respond(c, await members.removeProjectMember(auth.db, auth.userId, c.req.param("id")!, c.req.param("userId")!));
}
