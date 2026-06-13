import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { ideas, users } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { API_CONFIG } from "@/lib/config";
import { eq, desc } from "drizzle-orm";

export const runtime = "edge";

export async function GET(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);

  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

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
      author: {
        username: users.username,
        displayName: users.displayName,
      }
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.authorId, users.id))
    .orderBy(desc(ideas.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    data: results,
    meta: {
      limit,
      offset,
      count: results.length
    }
  });
}
