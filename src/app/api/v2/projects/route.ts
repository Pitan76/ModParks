import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { listProjectPosts } from "@/lib/queries/postList";
import { toApiProject } from "@/lib/api/toApi";
import type { ApiProject, ApiProjectPrivate, PaginatedResponse } from "@/types/api";
import { withPublicCache } from "@/lib/http/cache";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const db = await getDatabase();
  const viewer = await resolveViewer(request);

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "");
  const appSettings = await getAppSettings();
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
      const response: PaginatedResponse<ApiProject> = { data: [], meta: { limit, offset, count: 0 } };
      return withPublicCache(NextResponse.json(response));
    }
    authorId = authorProfile.userId;
    includeHidden = viewer.userId === authorId;
  }

  // ページング前提の一覧なので limit/offset をそのままクエリに渡す。
  // listProjectPosts は内部で limit を受けるが offset は未対応のため、ここで多めに取って切る。
  const rows = await listProjectPosts(db, {
    viewerId: viewer.userId,
    authorId,
    includeHidden,
    limit: offset + limit,
  });
  const page = rows.slice(offset, offset + limit);

  const data = page.map((row) => toApiProject(row, viewer, row.tags)) as ApiProject[] | ApiProjectPrivate[];

  const response: PaginatedResponse<ApiProject> = {
    data: data as ApiProject[],
    meta: { limit, offset, count: data.length },
  };

  return withPublicCache(NextResponse.json(response));
}
