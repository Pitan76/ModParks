import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects, projectTags } from "@/db/schema";
import { createProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { db, session } = await getAuthenticatedDb();
    
    // Auth.js may redirect to login if unauthorized, but getAuthenticatedDb throws Error
    // We should catch it and return 401
    
    const formData = await req.formData();
    const raw = {
      name:        formData.get("name"),
      slug:        formData.get("slug"),
      description: formData.get("description"),
      type:        formData.get("type"),
      license:     formData.get("license"),
      sourceUrl:   formData.get("sourceUrl"),
      links:       formData.get("links"),
      tags:        formData.getAll("tags"),
    };

    const parsed = createProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, slug, description, type, license, sourceUrl, links, tags } = parsed.data;
    const id = createId();

    const existingProject = await db.select().from(projects).where(eq(projects.slug, slug)).get();
    if (existingProject) {
      return NextResponse.json({ error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } }, { status: 400 });
    }

    const { userSettings, ideas } = await import("@/db/schema");
    const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    const status = (settingsRecord?.defaultProjectStatus as any) || "draft";
    const commentsEnabled = settingsRecord?.defaultCommentsEnabled ?? false;

    const modrinthId = formData.get("modrinthId") as string | null;
    const curseforgeId = formData.get("curseforgeId") as string | null;
    const issueTrackerUrl = formData.get("issueTrackerUrl") as string | null;
    const extDlStr = formData.get("externalDownloads") as string | null;
    const externalDownloads = extDlStr ? parseInt(extDlStr, 10) : 0;
    const ideaId = formData.get("ideaId") as string | null;

    await db.insert(projects).values({
      id,
      slug,
      name,
      description,
      type,
      license,
      sourceUrl:  sourceUrl || null,
      links:      links || null,
      iconUrl:    formData.get("iconUrl") as string | null,
      authorId:   session.user.id,
      status:     status,
      modrinthId,
      curseforgeId,
      issueTrackerUrl,
      externalDownloads: {}, // Expects an object, not a number
      commentsEnabled,
      sourceIdeaId: ideaId,
    }).run();

    if (ideaId) {
      await db.update(ideas).set({ status: "fulfilled", updatedAt: new Date() }).where(eq(ideas.id, ideaId)).run();
    }

    if (tags.length > 0) {
      await db.insert(projectTags).values(
        tags.map((tag) => ({ projectId: id, tag }))
      ).run();
    }

    return NextResponse.json({ success: true, slug });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API /projects Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
