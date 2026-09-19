import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { userProfiles } from "@modparks/core/db/schema";
import { resolveViewer } from "@modparks/core/api-auth";
import { readAppSettings } from "@modparks/core/config/readSettings";
import { listProjectPosts } from "@modparks/core/queries/postList";
import { toApiProject } from "@modparks/core/api/toApi";
import { withPublicCache } from "@modparks/core/http/cache";
import type { ApiProject, ApiProjectPrivate, PaginatedResponse } from "@modparks/core/types/api";

/**
 * /api/v2/projects (GET) の本体。
 *
 * Next のルートハンドラと Hono(workers/api) の両方から呼ぶ。実装を 1 つに
 * しておけば、ルートパターンを外すだけで Next 側へ戻せる。
 */
export type ApiContext = { db: Database; kv: KVNamespace };

export async function handleListProjects(ctx: ApiContext, request: Request): Promise<Response> {
  const { db } = ctx;
  const viewer = await resolveViewer(db, request);

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "");
  const appSettings = await readAppSettings(ctx.kv);
  const limit = isNaN(limitParam) ? appSettings.apiDefaultLimit : Math.min(limitParam, appSettings.apiMaxLimit);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);
  const authorUsername = searchParams.get("author");

  let authorId: string | undefined;
  // includeHidden は自分自身の一覧を見るときだけ。他人の author= 指定では常に公開分のみ
  let includeHidden = false;
  if (authorUsername) {
    const authorProfile = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.username, authorUsername))
      .get();
    if (!authorProfile) {
      const empty: PaginatedResponse<ApiProject> = { data: [], meta: { limit, offset, count: 0 } };

      return withPublicCache(Response.json(empty));
    }
    authorId = authorProfile.userId;
    includeHidden = viewer.userId === authorId;
  }

  const rows = await listProjectPosts(db, { viewerId: viewer.userId, authorId, includeHidden, limit, offset });
  const data = rows.map((row) => toApiProject(row, viewer, row.tags)) as ApiProject[] | ApiProjectPrivate[];

  const response: PaginatedResponse<ApiProject> = {
    data: data as ApiProject[],
    meta: { limit, offset, count: data.length },
  };

  return withPublicCache(Response.json(response));
}
