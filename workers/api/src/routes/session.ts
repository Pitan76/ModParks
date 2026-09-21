import type { Context } from "hono";
import { getDb } from "@modparks/core/db/client";
import type { ApiWorkerEnv } from "../env";
import { readSession } from "../session";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * GET /api/app/session — このリクエストが誰としてログインしているかを返す。
 *
 * modparks-api の AUTH_SECRET がメイン Worker と一致しているかを、副作用なしで
 * 確かめるためのもの。ログイン中のブラウザで開いて userId が返れば一致している。
 * 一致していなければ Cookie を復号できず 401 になる。
 *
 * 返すのは呼び出した本人のユーザーIDだけなので、他人の情報は漏れない。
 */
export async function getSession(c: Ctx): Promise<Response> {
  if (!c.env.AUTH_SECRET) return c.json({ error: "AUTH_SECRET is not configured on modparks-api" }, 503);

  const session = await readSession(getDb(c.env.DB), c.req.raw, c.env.AUTH_SECRET);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  return c.json({ userId: session.userId }, 200, { "Cache-Control": "no-store" });
}
