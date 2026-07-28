import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { posts, projects, users } from "@/db/schema";
import { validateApiKey, resolveViewer } from "@/lib/api-auth";
import { eq, and } from "drizzle-orm";
import type { ApiProjectDetail } from "@/types/api-v1";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { listProjectPosts } from "@/lib/queries/postList";
import { getProjectDependencies, getProjectDependents } from "@/lib/actions/dependency";
import { canViewPost } from "@/lib/auth/postAccess";
import { withPublicCache } from "@/lib/http/cache";

/**
 * v1 互換シム。
 * v1 のフィールド名（name/description/status）はこの境界だけで v2 の形から詰め替える。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDatabase();
  const { slug } = await params;

  const projectStub = await findProjectPostBySlug(db, slug);
  if (!projectStub) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const viewer = await resolveViewer(request);
  if (!canViewPost(projectStub, viewer)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [project] = await listProjectPosts(db, { viewerId: viewer.userId, postIds: [projectStub.id], includeHidden: true });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [dependencies, dependents] = await Promise.all([
    getProjectDependencies(project.id),
    getProjectDependents(project.id),
  ]);

  const data: ApiProjectDetail = {
    id: project.id,
    slug: project.slug,
    name: project.title,
    description: project.body,
    iconUrl: project.iconUrl,
    type: project.type,
    license: project.license,
    downloads: {
      total: project.totalDownloads,
      native: project.downloads,
      ...(project.externalDownloads as Record<string, number>),
    },
    createdAt: project.createdAt ? new Date(project.createdAt).getTime() : 0,
    updatedAt: project.updatedAt ? new Date(project.updatedAt).getTime() : 0,
    author: {
      username: project.author.username || "unknown",
      displayName: project.author.displayName || null,
      avatarUrl: project.author.avatarUrl || null,
    },
    tags: project.tags,
    dependencies: dependencies.map(d => ({
      id: d.id,
      dependencyType: d.dependencyType,
      project: { id: d.project.id, slug: d.project.slug, name: d.project.title, iconUrl: d.project.iconUrl },
    })),
    dependents: dependents.map(d => ({
      id: d.id,
      dependencyType: d.dependencyType,
      project: { id: d.project.id, slug: d.project.slug, name: d.project.title, iconUrl: d.project.iconUrl },
    })),
  };

  return withPublicCache(NextResponse.json(data));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDatabase();

  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const project = await findProjectPostBySlug(db, slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const userRecord = await db.select().from(users).where(eq(users.id, auth.userId)).get();
  if (project.authorId !== auth.userId && userRecord?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 共通カラムは posts、Project 固有カラムは projects へ。書き込み先が分かれる。
  const postUpdates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) postUpdates.title = body.name;
  if (body.description !== undefined) postUpdates.body = body.description;
  if (body.slug !== undefined) {
    const existing = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.kind, "project"), eq(posts.slug, body.slug))).get();
    if (existing && existing.id !== project.id) {
      return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
    }
    postUpdates.slug = body.slug;
    postUpdates.previousSlug = project.slug;
  }

  const projectUpdates: Record<string, unknown> = {};
  if (body.type !== undefined) projectUpdates.type = body.type;

  if (Object.keys(projectUpdates).length > 0) {
    await db.batch([
      db.update(posts).set(postUpdates).where(eq(posts.id, project.id)),
      db.update(projects).set(projectUpdates).where(eq(projects.id, project.id)),
    ]);
  } else {
    await db.update(posts).set(postUpdates).where(eq(posts.id, project.id)).run();
  }

  return NextResponse.json({ success: true });
}
