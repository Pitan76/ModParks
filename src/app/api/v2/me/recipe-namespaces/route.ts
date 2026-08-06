/**
 * 本人が所有するプロジェクトのレシピネームスペース一覧。
 *
 * ModParks Recipe が namespace の所有権を verified として認めるかの判定に使う。
 * 判定側（mp-recipe）はユーザーの投稿物そのものを知る必要が無く、ここが返す一覧だけで足りる。
 */
import { NextResponse } from "next/server";
import { requireBearerScope } from "@/lib/oauth/bearer";
import { getDatabase } from "@/lib/db";
import { posts, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const auth = await requireBearerScope(request, "projects:read");
  if (!auth.ok) return auth.response;

  const db = await getDatabase();
  const rows = await db
    .select({ namespaces: projects.recipeNamespaces })
    .from(projects)
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(posts.authorId, auth.token.userId))
    .all();

  const namespaces = new Set<string>();
  for (const row of rows) {
    if (!Array.isArray(row.namespaces)) continue;
    for (const ns of row.namespaces) namespaces.add(ns);
  }

  return NextResponse.json(
    { namespaces: [...namespaces].sort() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
