import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects, projectTags } from "@/db/schema";
import { createProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { vk } from "@/lib/validationKeys";

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

    const existingProject = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.kind, "project"), eq(posts.slug, slug))).get();
    if (existingProject) {
      return NextResponse.json({ error: { slug: [vk("slugTaken")] } }, { status: 400 });
    }

    const { userSettings, ideas } = await import("@/db/schema");
    const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    const visibility = (settingsRecord?.defaultProjectStatus as any) || "draft";
    const commentsEnabled = settingsRecord?.defaultCommentsEnabled ?? false;
    const recipesEnabled = settingsRecord?.defaultRecipesEnabled ?? false;

    const modrinthId = formData.get("modrinthId") as string | null;
    const curseforgeId = formData.get("curseforgeId") as string | null;
    const issueTrackerUrl = formData.get("issueTrackerUrl") as string | null;
    const ideaId = formData.get("ideaId") as string | null;

    // posts と projects は必ず同時に作る（DESIGN.md 12章）。D1 は transaction() 非対応のため batch を使う。
    await db.batch([
      db.insert(posts).values({
        id,
        authorId: session.user.id,
        kind: "project",
        slug,
        title: name,
        body: description,
        bodyFormat: "markdown",
        visibility,
      }),
      db.insert(projects).values({
        id,
        type,
        license,
        sourceUrl:  sourceUrl || null,
        links:      links || null,
        iconUrl:    formData.get("iconUrl") as string | null,
        modrinthId,
        curseforgeId,
        issueTrackerUrl,
        externalDownloads: {},
        commentsEnabled,
        recipesEnabled,
        sourceIdeaId: ideaId,
      }),
    ]);

    if (ideaId) {
      await db.batch([
        db.update(ideas).set({ status: "fulfilled" }).where(eq(ideas.id, ideaId)),
        db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, ideaId)),
      ]);
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
