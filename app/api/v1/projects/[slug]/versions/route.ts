import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, versions } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, desc } from "drizzle-orm";



export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const d1 = await getD1();
  const db = getDb(d1);

  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const slug = params.slug;

  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1);
  
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const results = await db
    .select()
    .from(versions)
    .where(eq(versions.projectId, project.id))
    .orderBy(desc(versions.createdAt));

  const data = results.map(v => ({
    id: v.id,
    versionNumber: v.versionNumber,
    changelog: v.changelog,
    fileSize: v.fileSize,
    downloads: v.downloads,
    createdAt: v.createdAt,
    loaders: JSON.parse(v.loaders),
    mcVersions: JSON.parse(v.mcVersions),
    downloadUrl: `/api/download/${v.id}`
  }));

  return NextResponse.json({ data });
}
