import type { Context } from "hono";
import { listCollectionsWithProjectStatus, listUserCollections } from "@modparks/core/queries/collections";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * GET /api/app/collections — 本人のコレクション一覧（非公開も含む）。
 *
 * ?projectId= を付けると、それぞれにそのプロジェクトが入っているかも返す。
 * 誰の一覧かはセッションだけで決め、クライアントから ID を受け取らない。
 * 以前の Server Action は userId / viewerId を引数で受け取っており、
 * 他人の ID を渡すと非公開コレクションを読めてしまっていた。
 */
export async function getMyCollections(c: Ctx): Promise<Response> {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const projectId = c.req.query("projectId");
  const data = projectId
    ? await listCollectionsWithProjectStatus(auth.db, auth.userId, projectId)
    : await listUserCollections(auth.db, auth.userId, auth.userId);

  return c.json(data, 200, { "Cache-Control": "private, no-store" });
}
