import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, versions, projectMembers } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, desc, and } from "drizzle-orm";
import { ApiVersion } from "@/types/api";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const d1 = await getD1();
  const db = getDb(d1);



  const { slug } = await params;

  const [project] = await db.select({ id: projects.id, status: projects.status, authorId: projects.authorId }).from(projects).where(eq(projects.slug, slug)).limit(1);
  
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

  const results = await db
    .select()
    .from(versions)
    .where(eq(versions.projectId, project.id))
    .orderBy(desc(versions.createdAt));

  const data: ApiVersion[] = results.map(v => ({
    id: v.id,
    versionNumber: v.versionNumber,
    changelog: v.changelog,
    fileSize: v.fileSize,
    fileSha256: v.fileSha256,
    fileName: v.fileName,
    downloads: v.downloads,
    createdAt: v.createdAt ? new Date(v.createdAt).getTime() : 0,
    loaders: JSON.parse(v.loaders),
    mcVersions: JSON.parse(v.mcVersions),
    fileUrl: `/api/download?versionId=${v.id}`
  }));

  return NextResponse.json({ data });
}
