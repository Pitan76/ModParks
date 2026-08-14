import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { findIdeaPostBySlug } from "@/lib/queries/post";
import { listPostComments, countPostRootComments, createPostComment } from "@/lib/api/postComments";
import { notifyToUser, resolveActor } from "@/lib/notifications/notify";
import type { PaginatedResponse, ApiComment } from "@/types/api";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDatabase();

  const idea = await findIdeaPostBySlug(db, slug);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "");
  const limit = isNaN(limitParam) ? undefined : Math.min(Math.max(limitParam, 1), 100);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const [data, count] = await Promise.all([
    listPostComments(db, idea.id, { limit, offset }),
    countPostRootComments(db, idea.id),
  ]);
  const response: PaginatedResponse<ApiComment> = { data, meta: { limit: limit ?? count, offset, count } };
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
  const idea = await findIdeaPostBySlug(db, slug);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  const { id, parentAuthorId } = await createPostComment(db, idea.id, session.user.id, { ...body, content });

  const actor = await resolveActor(db, session.user.id);
  const payload = { kind: "idea" as const, slug: idea.slug, title: idea.title, ...actor };
  if (parentAuthorId) {
    await notifyToUser(db, parentAuthorId, session.user.id, "comment_reply", payload);
  } else {
    await notifyToUser(db, idea.authorId, session.user.id, "comment", payload);
  }

  return NextResponse.json({ success: true, id });
}
