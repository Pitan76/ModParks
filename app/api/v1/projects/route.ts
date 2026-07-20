import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users, userProfiles, projectTags } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { eq, desc, and, inArray, like } from "drizzle-orm";
import { ApiProject, PaginatedResponse } from "@/types/api";
import { createId } from "@paralleldrive/cuid2";
import { withPublicCache } from "@/lib/http/cache";

export async function GET(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);



  const { searchParams } = new URL(request.url);
  
  const limitParam = parseInt(searchParams.get("limit") || "");
  const appSettings = await getAppSettings();
  const limit = isNaN(limitParam) ? appSettings.apiDefaultLimit : Math.min(limitParam, appSettings.apiMaxLimit);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);
  
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") || "downloads";
  const author = searchParams.get("author");

  let conditions = [eq(projects.status, "public")];
  
  // 自分自身のリクエストかチェックするため、APIキーがあるか確認する
  let isMine = false;
  if (author) {
    const auth = await validateApiKey(request);
    if (auth.valid && auth.userId) {
      const [u] = await db.select().from(userProfiles).where(eq(userProfiles.username, author)).limit(1);
      if (u && u.userId === auth.userId) {
        isMine = true;
      }
    }
    
    if (isMine) {
      // 自分の場合は、status=public の条件を外し、全て表示するか、削除済み以外とする
      conditions = []; 
    }
    conditions.push(eq(userProfiles.username, author));
  }

  if (type === "mod" || type === "plugin" || type === "resourcepack" || type === "datapack" || type === "shader" || type === "modpack") {
    conditions.push(eq(projects.type, type as "mod" | "plugin" | "resourcepack" | "datapack" | "shader" | "modpack"));
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
      totalDownloads: projects.totalDownloads,
      externalDownloads: projects.externalDownloads,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
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

  const data: ApiProject[] = results.map(p => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    iconUrl: p.iconUrl,
    type: p.type as "mod" | "plugin" | "resourcepack" | "datapack" | "shader" | "modpack",
    license: p.license,
    downloads: {
      total: p.totalDownloads,
      native: p.downloads,
      ...(p.externalDownloads as Record<string, number>)
    },
    createdAt: p.createdAt ? new Date(p.createdAt).getTime() : 0,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : 0,
    author: {
      username: p.author?.username || "unknown",
      displayName: p.author?.displayName || null,
      avatarUrl: p.author?.avatarUrl || null,
    },
    tags: p.id ? (tagsMap[p.id] || []) : []
  }));

  const response: PaginatedResponse<ApiProject> = {
    data,
    meta: {
      limit,
      offset,
      count: data.length
    }
  };

  return withPublicCache(NextResponse.json(response));
}

export async function POST(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);

  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, slug, description, type } = body;

  if (!name || !slug || !type) {
    return NextResponse.json({ error: "name, slug, and type are required" }, { status: 400 });
  }

  const existing = await db.select().from(projects).where(eq(projects.slug, slug)).get();
  if (existing) {
    return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
  }

  const id = createId();

  await db.insert(projects).values({
    id,
    slug,
    name,
    description: description || "",
    descriptionFormat: "markdown",
    type,
    license: "All Rights Reserved",
    authorId: auth.userId,
    status: "draft",
  }).run();

  return NextResponse.json({
    success: true,
    data: { id, slug, name, type }
  });
}
