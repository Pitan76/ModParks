import type { Context } from "hono";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";

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
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  return c.json({ userId: auth.userId }, 200, { "Cache-Control": "no-store" });
}
