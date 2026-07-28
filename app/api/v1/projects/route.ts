import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { eq, desc, and, inArray, like } from "drizzle-orm";
import type { ApiProject, PaginatedResponse } from "@/types/api-v1";
import { createId } from "@paralleldrive/cuid2";
import { withPublicCache } from "@/lib/http/cache";
import { posts, projects, userProfiles, projectTags } from "@/db/schema";

/**
 * v1 互換シム。
 *
 * v1 のフィールド名（name/description/status）は廃止したドメインの用語なので、
 * 内部では使わず、この境界だけで posts/projects から詰め替える。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
export async function GET(request: Request) {
  const db = await getDatabase();

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

  const conditions = [eq(posts.kind, "project" as const)];

  let isMine = false;
  if (author) {
    const auth = await validateApiKey(request);
    if (auth.valid && auth.userId) {
      const u = await db.select().from(userProfiles).where(eq(userProfiles.username, author)).get();
      if (u && u.userId === auth.userId) isMine = true;
    }
    conditions.push(eq(userProfiles.username, author));
  }
  if (!isMine) conditions.push(eq(posts.visibility, "public"));

  if (type === "mod" || type === "plugin" || type === "resourcepack" || type === "datapack" || type === "shader" || type === "modpack") {
    conditions.push(eq(projects.type, type));
  }
  if (q) {
    conditions.push(like(posts.title, `%${q}%`));
  }

  let orderBy;
  if (sort === "updated") orderBy = desc(posts.updatedAt);
  else if (sort === "newest") orderBy = desc(posts.createdAt);
  else orderBy = desc(projects.downloads);

  const results = await db
    .select({
      post: posts,
      project: projects,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .leftJoin(userProfiles, eq(posts.authorId, userProfiles.userId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)
    .all();

  const projectIds = results.map(r => r.post.id);
  let tagsMap: Record<string, string[]> = {};
  if (projectIds.length > 0) {
    const tags = await db.select().from(projectTags).where(inArray(projectTags.projectId, projectIds));
    tags.forEach(t => {
      if (!tagsMap[t.projectId]) tagsMap[t.projectId] = [];
      tagsMap[t.projectId].push(t.tag);
    });
  }

  const data: ApiProject[] = results.map(r => ({
    id: r.post.id,
    slug: r.post.slug,
    name: r.post.title,
    description: r.post.body,
    iconUrl: r.project.iconUrl,
    type: r.project.type,
    license: r.project.license,
    downloads: {
      total: r.project.totalDownloads,
      native: r.project.downloads,
      ...(r.project.externalDownloads as Record<string, number>),
    },
    createdAt: r.post.createdAt ? new Date(r.post.createdAt).getTime() : 0,
    updatedAt: r.post.updatedAt ? new Date(r.post.updatedAt).getTime() : 0,
    author: {
      username: r.authorUsername || "unknown",
      displayName: r.authorDisplayName || null,
      avatarUrl: r.authorAvatarUrl || null,
    },
    tags: tagsMap[r.post.id] || [],
  }));

  const response: PaginatedResponse<ApiProject> = { data, meta: { limit, offset, count: data.length } };
  return withPublicCache(NextResponse.json(response));
}

export async function POST(request: Request) {
  const db = await getDatabase();

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

  const existing = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.kind, "project"), eq(posts.slug, slug))).get();
  if (existing) {
    return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
  }

  const id = createId();

  // posts と projects は必ず同時に作る（DESIGN.md 12章）。D1 は transaction() 非対応のため batch を使う。
  await db.batch([
    db.insert(posts).values({
      id,
      authorId: auth.userId,
      kind: "project",
      slug,
      title: name,
      body: description || "",
      bodyFormat: "markdown",
      visibility: "draft",
    }),
    db.insert(projects).values({
      id,
      type,
      license: "All Rights Reserved",
    }),
  ]);

  return NextResponse.json({ success: true, data: { id, slug, name, type } });
}
