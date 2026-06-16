import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { ideas, users } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { API_CONFIG } from "@/lib/config";
import { eq, desc } from "drizzle-orm";
import { ApiIdea, PaginatedResponse } from "@/types/api";

export async function GET(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);



  const { searchParams } = new URL(request.url);
  
  const limitParam = parseInt(searchParams.get("limit") || "");
  const limit = isNaN(limitParam) ? API_CONFIG.DEFAULT_LIMIT : Math.min(limitParam, API_CONFIG.MAX_LIMIT);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const results = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      status: ideas.status,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
      author: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.authorId, users.id))
    .orderBy(desc(ideas.createdAt))
    .limit(limit)
    .offset(offset);

  const data: ApiIdea[] = results.map(i => ({
    id: i.id,
    title: i.title,
    content: i.content,
    status: i.status as "open" | "in_progress" | "fulfilled",
    createdAt: i.createdAt ? new Date(i.createdAt).getTime() : 0,
    updatedAt: i.updatedAt ? new Date(i.updatedAt).getTime() : 0,
    author: {
      username: i.author?.username || "unknown",
      displayName: i.author?.displayName || null,
      avatarUrl: i.author?.avatarUrl || null,
    }
  }));

  const response: PaginatedResponse<ApiIdea> = {
    data,
    meta: {
      limit,
      offset,
      count: data.length
    }
  };

  return NextResponse.json(response);
}
