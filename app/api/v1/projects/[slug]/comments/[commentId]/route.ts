import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { projectComments, projects, projectMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { recordDeletion } from "@/lib/backup/tombstone";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string, commentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { commentId } = await params;
    const body = (await request.json()) as any;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const contentFormat = typeof body?.contentFormat === "string" ? body.contentFormat.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "Content is too long" }, { status: 400 });
    }

    const db = await getDatabase();
    const comment = await db.select().from(projectComments).where(eq(projectComments.id, commentId)).get();
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // 編集は本文の書き換えであり、投稿者本人のみ許可（削除とは異なりモデレーション権限では編集しない）
    if (comment.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateObj: any = { content, updatedAt: new Date() };
    if (contentFormat) {
      updateObj.contentFormat = ["markdown", "plaintext", "pukiwiki"].includes(contentFormat) ? contentFormat : "markdown";
    }

    await db.update(projectComments)
      .set(updateObj)
      .where(eq(projectComments.id, commentId))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string, commentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { commentId } = await params;
    const db = await getDatabase();

    const comment = await db.select().from(projectComments).where(eq(projectComments.id, commentId)).get();
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const project = await db.select().from(projects).where(eq(projects.id, comment.projectId)).get();
    const isProjectOwner = project?.authorId === session.user.id;
    const isProjectMember = !!(await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, comment.projectId), eq(projectMembers.userId, session.user.id))).get());

    if (
      comment.authorId !== session.user.id &&
      !isProjectOwner &&
      !isProjectMember &&
      session.user.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(projectComments).where(eq(projectComments.id, commentId)).run();
    await recordDeletion(db, "project_comments", commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
