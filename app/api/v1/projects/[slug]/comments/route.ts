import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { projectComments, projects, users, userProfiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDatabase();
    
    const project = await db.select().from(projects).where(eq(projects.slug, slug)).get();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.commentsEnabled) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

    const comments = await db
      .select({
        id: projectComments.id,
        content: projectComments.content,
        createdAt: projectComments.createdAt,
        parentId: projectComments.parentId,
        authorId: users.id,
        authorName: userProfiles.displayName,
        authorAvatar: userProfiles.avatarUrl,
      })
      .from(projectComments)
      .innerJoin(users, eq(projectComments.authorId, users.id))
      .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(projectComments.projectId, project.id))
      .orderBy(desc(projectComments.createdAt))
      .all();

    return NextResponse.json(comments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const body = (await request.json()) as any;
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const db = await getDatabase();
    const project = await db.select().from(projects).where(eq(projects.slug, slug)).get();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.commentsEnabled) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

    const newCommentId = createId();
    await db.insert(projectComments).values({
      id: newCommentId,
      projectId: project.id,
      authorId: session.user.id,
      content: content.trim(),
    }).run();

    const { notifyToUser, resolveActorName } = await import("@/lib/notifications/notify");
    await notifyToUser(db, project.authorId, session.user.id, "project_comment", {
      projectSlug: project.slug,
      projectName: project.name,
      actorName: await resolveActorName(db, session.user.id),
    });

    return NextResponse.json({ success: true, id: newCommentId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
