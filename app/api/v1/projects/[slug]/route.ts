import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users, projectTags } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq } from "drizzle-orm";



export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const d1 = await getD1();
  const db = getDb(d1);

  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const slug = params.slug;

  const [project] = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      description: projects.description,
      iconUrl: projects.iconUrl,
      type: projects.type,
      license: projects.license,
      sourceUrl: projects.sourceUrl,
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
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const tags = await db.select().from(projectTags).where(eq(projectTags.projectId, project.id));

  return NextResponse.json({
    data: {
      ...project,
      tags: tags.map(t => t.tag)
    }
  });
}
