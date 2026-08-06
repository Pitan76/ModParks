import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { resolveViewer } from "@/lib/api-auth";
import { posts, projectMembers } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { listProjectPosts } from "@/lib/queries/postList";
import { toApiProject } from "@/lib/api/toApi";
import { canViewPost } from "@/lib/auth/postAccess";
import { getProjectDependencies, getProjectDependents } from "@/lib/actions/dependency";
import type { ApiProjectDetail, ApiProjectPrivateDetail, ApiDependency } from "@/types/api";
import { withPublicCache } from "@/lib/http/cache";

function toApiDependency(d: { id: string; dependencyType: ApiDependency["dependencyType"]; project: ApiDependency["project"] }): ApiDependency {
  return { id: d.id, dependencyType: d.dependencyType, project: d.project };
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDatabase();
  const { slug } = await params;

  // slug の存在確認と可視性判定は軽量な findProjectPostBySlug で先に済ませる。
  // previousSlug 経由のアクセスも拾えるため、正規の id をここで確定させる。
  const projectStub = await findProjectPostBySlug(db, slug);
  if (!projectStub) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const viewer = await resolveViewer(request);

  // メンバーかどうかは canManagePost が持たない情報なので、ここで補って渡す
  let memberIds: string[] | undefined;
  if (viewer.userId && projectStub.authorId !== viewer.userId) {
    const member = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectStub.id))
      .all();
    memberIds = member.map((m: { userId: string }) => m.userId);
  }

  if (!canViewPost({ ...projectStub, memberIds }, viewer)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // author / favoriteCount / commentCount / tags を含む表示用の形で改めて取得する
  const [project] = await listProjectPosts(db, {
    viewerId: viewer.userId,
    postIds: [projectStub.id],
    includeHidden: true,
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [dependencies, dependents] = await Promise.all([
    getProjectDependencies(project.id),
    getProjectDependents(project.id),
  ]);

  const apiProject = toApiProject(project, viewer, project.tags, memberIds);

  const data: ApiProjectDetail | ApiProjectPrivateDetail = {
    ...apiProject,
    dependencies: dependencies.map(toApiDependency),
    dependents: dependents.map(toApiDependency),
  } as ApiProjectDetail | ApiProjectPrivateDetail;

  return withPublicCache(NextResponse.json(data));
}
