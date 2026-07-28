import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { findIdeaPostBySlug } from "@/lib/queries/post";
import { listIdeaPosts } from "@/lib/queries/postList";
import { canViewPost } from "@/lib/auth/postAccess";
import type { ApiIdea } from "@/types/api-v1";

/**
 * v1 互換シム。
 *
 * v1 は id をそのまま URL に使っていた。Idea の slug は作成時 id と同じ値で
 * 初期化されるため（DESIGN.md「slugをIdeaにも持たせる」）、既存の /api/v1/ideas/{id}
 * は変更なしに動く。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDatabase();
  const { id } = await params;

  const ideaStub = await findIdeaPostBySlug(db, id);
  if (!ideaStub) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const viewer = await resolveViewer(request);
  if (!canViewPost(ideaStub, viewer)) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const [idea] = await listIdeaPosts(db, { viewerId: viewer.userId, postIds: [ideaStub.id], includeHidden: true });
  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const data: ApiIdea = {
    id: idea.id,
    title: idea.title,
    content: idea.body,
    status: idea.status,
    createdAt: idea.createdAt ? new Date(idea.createdAt).getTime() : 0,
    updatedAt: idea.updatedAt ? new Date(idea.updatedAt).getTime() : 0,
    author: {
      username: idea.author.username || "unknown",
      displayName: idea.author.displayName || null,
      avatarUrl: idea.author.avatarUrl || null,
    },
  };

  return NextResponse.json({ data });
}
