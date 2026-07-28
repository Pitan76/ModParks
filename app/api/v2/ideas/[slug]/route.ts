import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { findIdeaPostBySlug } from "@/lib/queries/post";
import { listIdeaPosts } from "@/lib/queries/postList";
import { toApiIdea } from "@/lib/api/toApi";
import { canViewPost } from "@/lib/auth/postAccess";
import type { ApiIdea, ApiIdeaPrivate } from "@/types/api";
import { withPublicCache } from "@/lib/http/cache";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDatabase();
  const { slug } = await params;

  const ideaStub = await findIdeaPostBySlug(db, slug);
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

  const data: ApiIdea | ApiIdeaPrivate = toApiIdea(idea, viewer);
  return withPublicCache(NextResponse.json(data));
}
