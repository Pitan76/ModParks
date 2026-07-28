import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { listIdeaPosts } from "@/lib/queries/postList";
import { toApiIdea } from "@/lib/api/toApi";
import type { ApiIdea, ApiIdeaPrivate, PaginatedResponse } from "@/types/api";
import { withPublicCache } from "@/lib/http/cache";

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

  const data = page.map((row) => toApiIdea(row, viewer)) as ApiIdea[] | ApiIdeaPrivate[];

  const response: PaginatedResponse<ApiIdea> = {
    data: data as ApiIdea[],
    meta: { limit, offset, count: data.length },
  };

  return withPublicCache(NextResponse.json(response));
}
