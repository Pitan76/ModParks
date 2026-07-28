import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { listPostComments, createPostComment } from "@/lib/api/postComments";
import { notifyToUser, resolveActorName } from "@/lib/notifications/notify";

/**
 * v1 互換シム。
 *
 * v1 は { id, content, contentFormat, createdAt, parentId, authorId, authorName, authorAvatar }
 * というフラットな独自形式を返していた。v2 の ApiComment（author をネストする形）とは
 * 形が異なるため、ここで詰め替える。実装（コメントの取得・作成）は lib/api/postComments に一本化済み。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDatabase();

    const project = await findProjectPostBySlug(db, slug);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.commentsEnabled) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

    const apiComments = await listPostComments(db, project.id);
    const data = apiComments.map(c => ({
      id: c.id,
      content: c.content,
      contentFormat: c.contentFormat,
      createdAt: c.createdAt,
      parentId: c.parentId,
      authorName: c.author.displayName,
      authorAvatar: c.author.avatarUrl,
    }));

    return NextResponse.json(data);
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
    const body = (await request.json()) as { content?: string; parentId?: string; contentFormat?: string };
    if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    const content = body.content;

    const db = await getDatabase();
    const project = await findProjectPostBySlug(db, slug);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.commentsEnabled) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

    const { id: newCommentId, parentAuthorId } = await createPostComment(db, project.id, session.user.id, { ...body, content });

    const actorName = await resolveActorName(db, session.user.id);
    const payload = { kind: "project" as const, slug: project.slug, title: project.title, actorName };
    if (parentAuthorId) {
      await notifyToUser(db, parentAuthorId, session.user.id, "comment_reply", payload);
    } else {
      await notifyToUser(db, project.authorId, session.user.id, "comment", payload);
    }

    return NextResponse.json({ success: true, id: newCommentId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
