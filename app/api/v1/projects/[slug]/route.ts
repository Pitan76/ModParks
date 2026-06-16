import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users, projectTags, projectMembers } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, and } from "drizzle-orm";
import { ApiProject } from "@/types/api";

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
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      status: projects.status,
      authorId: projects.authorId,
      author: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "public") {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    if (project.authorId !== auth.user.id) {
      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, auth.user.id))).limit(1);
      if (member.length === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
  }

  const tags = await db.select().from(projectTags).where(eq(projectTags.projectId, project.id));

  const data: ApiProject = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    iconUrl: project.iconUrl,
    type: project.type as "mod" | "plugin",
    license: project.license,
    downloads: project.downloads,
    createdAt: project.createdAt ? new Date(project.createdAt).getTime() : 0,
    updatedAt: project.updatedAt ? new Date(project.updatedAt).getTime() : 0,
    author: {
      username: project.author?.username || "unknown",
      displayName: project.author?.displayName || null,
      avatarUrl: project.author?.avatarUrl || null,
    },
    tags: tags.map(t => t.tag)
  };

  return NextResponse.json({ data });
}
