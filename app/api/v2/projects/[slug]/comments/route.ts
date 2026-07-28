import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { listPostComments, createPostComment } from "@/lib/api/postComments";
import { notifyToUser, resolveActorName } from "@/lib/notifications/notify";
import type { PaginatedResponse, ApiComment } from "@/types/api";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDatabase();

  const project = await findProjectPostBySlug(db, slug);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.commentsEnabled) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });

  const data = await listPostComments(db, project.id);
  const response: PaginatedResponse<ApiComment> = { data, meta: { limit: data.length, offset: 0, count: data.length } };
  return NextResponse.json(response);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
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

  const { id, parentAuthorId } = await createPostComment(db, project.id, session.user.id, { ...body, content });

  const actorName = await resolveActorName(db, session.user.id);
  const payload = { kind: "project" as const, slug: project.slug, title: project.title, actorName };
  if (parentAuthorId) {
    await notifyToUser(db, parentAuthorId, session.user.id, "comment_reply", payload);
  } else {
    await notifyToUser(db, project.authorId, session.user.id, "comment", payload);
  }

  return NextResponse.json({ success: true, id });
}
