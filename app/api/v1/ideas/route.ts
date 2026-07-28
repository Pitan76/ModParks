import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { listIdeaPosts } from "@/lib/queries/postList";
import type { ApiIdea, PaginatedResponse } from "@/types/api-v1";
import { withPublicCache } from "@/lib/http/cache";

/**
 * v1 互換シム。
 * v1 の ApiIdea は content フィールドを持つ（v2 では body）。この境界だけで詰め替える。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
export async function GET(request: Request) {
  const db = await getDatabase();
  const viewer = await resolveViewer(request);

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "");
  const appSettings = await getAppSettings();
  const limit = isNaN(limitParam) ? appSettings.apiDefaultLimit : Math.min(limitParam, appSettings.apiMaxLimit);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const rows = await listIdeaPosts(db, { viewerId: viewer.userId, limit: offset + limit });
  const page = rows.slice(offset, offset + limit);

  const data: ApiIdea[] = page.map(i => ({
    id: i.id,
    title: i.title,
    content: i.body,
    status: i.status,
    createdAt: i.createdAt ? new Date(i.createdAt).getTime() : 0,
    updatedAt: i.updatedAt ? new Date(i.updatedAt).getTime() : 0,
    author: {
      username: i.author.username || "unknown",
      displayName: i.author.displayName || null,
      avatarUrl: i.author.avatarUrl || null,
    },
  }));

  const response: PaginatedResponse<ApiIdea> = { data, meta: { limit, offset, count: data.length } };
  return withPublicCache(NextResponse.json(response));
}
