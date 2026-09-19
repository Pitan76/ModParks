import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { findIdeaPostBySlug } from "@modparks/core/queries/post";
import { listIdeaPosts } from "@modparks/core/queries/postList";
import { toApiIdea } from "@modparks/core/api/toApi";
import { canViewPost } from "@modparks/core/auth/postAccess";
import type { ApiIdea, ApiIdeaPrivate } from "@modparks/core/types/api";
import { withPublicCache } from "@/lib/http/cache";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDatabase();
  const { slug } = await params;

  const ideaStub = await findIdeaPostBySlug(db, slug);
  if (!ideaStub) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const viewer = await resolveViewer(db, request);
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
