import { getDb, getD1 } from "@/lib/db";
import { ideas, ideaLikes, ideaComments, users, userProfiles, versions, versionIdeas, projects } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function getIdeaMeta(id: string) {
  const d1 = await getD1();
  const db = getDb(d1);
  return db
    .select({
      title: ideas.title,
      content: ideas.content,
      contentFormat: ideas.contentFormat,
      visibility: ideas.visibility,
    })
    .from(ideas)
    .where(eq(ideas.id, id))
    .get();
}

/** アイデアに紐づくバージョンと、そのアイデアを元に作られたプロジェクトを1つのリストへ統合する。 */
function mergeResolvedProjects(
  linkedVersions: Awaited<ReturnType<typeof fetchLinked>>[0][],
  sourceIdeaProjects: Awaited<ReturnType<typeof fetchSource>>[0][]
) {
  const map = new Map<string, {
    projectId: string;
    projectName: string;
    projectSlug: string;
    projectDescription: string | null;
    versionNumber: string | null;
  }>();

  for (const p of sourceIdeaProjects) {
    map.set(p.projectId, { ...p, versionNumber: null });
  }
  for (const v of linkedVersions) {
    const existing = map.get(v.projectId);
    if (!existing) {
      map.set(v.projectId, {
        projectId: v.projectId,
        projectName: v.projectName,
        projectSlug: v.projectSlug,
        projectDescription: v.projectDescription,
        versionNumber: v.versionNumber,
      });
    } else if (!existing.versionNumber) {
      existing.versionNumber = v.versionNumber;
    }
  }
  return Array.from(map.values());
}

function fetchLinked(db: ReturnType<typeof getDb>, id: string) {
  return db
    .select({
      versionId: versions.id,
      versionNumber: versions.versionNumber,
      projectId: projects.id,
      projectName: projects.name,
      projectSlug: projects.slug,
      projectDescription: projects.description,
    })
    .from(versionIdeas)
    .innerJoin(versions, eq(versionIdeas.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .where(eq(versionIdeas.ideaId, id))
    .all();
}

function fetchSource(db: ReturnType<typeof getDb>, id: string) {
  return db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      projectSlug: projects.slug,
      projectDescription: projects.description,
    })
    .from(projects)
    .where(eq(projects.sourceIdeaId, id))
    .all();
}

export async function getIdeaDetail(id: string, userId?: string) {
  const d1 = await getD1();
  const db = getDb(d1);

  const ideaData = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      contentFormat: ideas.contentFormat,
      status: ideas.status,
      visibility: ideas.visibility,
      createdAt: ideas.createdAt,
      authorId: users.id,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      authorUsername: userProfiles.username,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideas.id, id))
    .get();

  if (!ideaData) return null;

  const [likesData, userLike] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(ideaLikes).where(eq(ideaLikes.ideaId, id)).get(),
    userId
      ? db.select().from(ideaLikes).where(and(eq(ideaLikes.ideaId, id), eq(ideaLikes.userId, userId))).get()
      : null,
  ]);

  const comments = await db
    .select({
      id: ideaComments.id,
      content: ideaComments.content,
      contentFormat: ideaComments.contentFormat,
      createdAt: ideaComments.createdAt,
      updatedAt: ideaComments.updatedAt,
      parentId: ideaComments.parentId,
      authorId: ideaComments.authorId,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      authorUsername: userProfiles.username,
    })
    .from(ideaComments)
    .innerJoin(users, eq(ideaComments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideaComments.ideaId, id))
    .orderBy(desc(ideaComments.createdAt))
    .all();

  const [linkedVersions, sourceIdeaProjects] = await Promise.all([fetchLinked(db, id), fetchSource(db, id)]);

  return {
    ideaData,
    initialCount: likesData?.count || 0,
    initialLiked: !!userLike,
    comments,
    resolvedProjects: mergeResolvedProjects(linkedVersions, sourceIdeaProjects),
  };
}

export type IdeaDetail = NonNullable<Awaited<ReturnType<typeof getIdeaDetail>>>;
