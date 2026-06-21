import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users, userProfiles, projectTags, projectMembers } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, and } from "drizzle-orm";
import { ApiProjectDetail } from "@/types/api";
import { getProjectDependencies, getProjectDependents } from "@/lib/actions/dependency";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const d1 = await getD1();
  const db = getDb(d1);



  const { slug } = await params;

  const [project] = await db
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
      status: projects.status,
      authorId: projects.authorId,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "public") {
    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    if (project.authorId !== auth.userId) {
      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, auth.userId))).limit(1);
      if (member.length === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
  }

  const tags = await db.select().from(projectTags).where(eq(projectTags.projectId, project.id));

  const [dependencies, dependents] = await Promise.all([
    getProjectDependencies(project.id),
    getProjectDependents(project.id),
  ]);

  const data: ApiProjectDetail = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    iconUrl: project.iconUrl,
    type: project.type as "mod" | "plugin",
    license: project.license,
    downloads: {
      total: project.totalDownloads,
      native: project.downloads,
      ...(project.externalDownloads as Record<string, number>)
    },
    createdAt: project.createdAt ? new Date(project.createdAt).getTime() : 0,
    updatedAt: project.updatedAt ? new Date(project.updatedAt).getTime() : 0,
    author: {
      username: project.author?.username || "unknown",
      displayName: project.author?.displayName || null,
      avatarUrl: project.author?.avatarUrl || null,
    },
    tags: tags.map(t => t.tag),
    dependencies: dependencies.map(d => ({
      id: d.id,
      dependencyType: d.dependencyType,
      project: {
        id: d.project.id,
        slug: d.project.slug,
        name: d.project.name,
        iconUrl: d.project.iconUrl
      }
    })),
    dependents: dependents.map(d => ({
      id: d.id,
      dependencyType: d.dependencyType,
      project: {
        id: d.project.id,
        slug: d.project.slug,
        name: d.project.name,
        iconUrl: d.project.iconUrl
      }
    }))
  };

  return NextResponse.json(data);
}
