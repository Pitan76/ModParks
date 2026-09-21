import type { Context } from "hono";
import { getDb, type Database } from "@modparks/core/db/client";
import type { ApiWorkerEnv } from "./env";
import { readSession } from "./session";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * /api/app/* の各ルートの入口で、ログイン中の本人を確かめる。
 *
 * 取れなければそのまま返せる応答を、取れれば db と本人の ID を返す。
 * AUTH_SECRET が無いと @auth/core が例外を投げて原因の分からない 500 になるので、
 * 先に確かめて 503 と原因を返す（設定漏れはデプロイ直後に起きやすい）。
 */
export async function requireSession(c: Ctx): Promise<{ db: Database; userId: string } | Response> {
  if (!c.env.AUTH_SECRET) return c.json({ error: "AUTH_SECRET is not configured on modparks-api" }, 503);

  const db = getDb(c.env.DB);
  const session = await readSession(db, c.req.raw, c.env.AUTH_SECRET);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  return { db, userId: session.userId };
}
