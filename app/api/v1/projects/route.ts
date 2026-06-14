import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users, projectTags } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { API_CONFIG } from "@/lib/config";
import { eq, desc, and, inArray, like } from "drizzle-orm";



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
  
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") || "downloads";

  let conditions = [eq(projects.status, "published")];
  if (type === "mod" || type === "plugin") {
    conditions.push(eq(projects.type, type as "mod" | "plugin"));
  }
  if (q) {
    conditions.push(like(projects.name, `%${q}%`));
  }

  let orderBy;
  if (sort === "updated") {
    orderBy = desc(projects.updatedAt);
  } else if (sort === "newest") {
    orderBy = desc(projects.createdAt);
  } else {
    orderBy = desc(projects.downloads);
  }

  const results = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      description: projects.description,
      iconUrl: projects.iconUrl,
      type: projects.type,
      license: projects.license,
      downloads: projects.downloads,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      author: {
        username: users.username,
        displayName: users.displayName,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const projectIds = results.map(p => p.id);
  let tagsMap: Record<string, string[]> = {};
  if (projectIds.length > 0) {
    const tags = await db.select().from(projectTags).where(inArray(projectTags.projectId, projectIds));
    tags.forEach(t => {
      if (!tagsMap[t.projectId]) tagsMap[t.projectId] = [];
      tagsMap[t.projectId].push(t.tag);
    });
  }

  const data = results.map(p => ({
    ...p,
    tags: tagsMap[p.id] || []
  }));

  return NextResponse.json({
    data,
    meta: {
      limit,
      offset,
      count: data.length
    }
  });
}
