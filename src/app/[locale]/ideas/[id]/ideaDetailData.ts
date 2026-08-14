import { getDb, getD1 } from "@/lib/db";
import { posts, ideas, favorites, comments as commentsTable, users, userProfiles, versions, versionIdeas, projects } from "@/db/schema";
import { eq, and, or, sql, desc, isNull, inArray } from "drizzle-orm";
import { getProjectsByIds } from "@/lib/actions/projectQuery";

export async function getIdeaMeta(id: string) {
  const d1 = await getD1();
  const db = getDb(d1);
  return db
    .select({
      authorId: posts.authorId,
      title: posts.title,
      content: posts.body,
      contentFormat: posts.bodyFormat,
      visibility: posts.visibility,
    })
    .from(posts)
    .where(and(eq(posts.kind, "idea"), or(eq(posts.slug, id), eq(posts.previousSlug, id))))
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
      projectId: posts.id,
      projectName: posts.title,
      projectSlug: posts.slug,
      projectDescription: posts.body,
    })
    .from(versionIdeas)
    .innerJoin(versions, eq(versionIdeas.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(versionIdeas.ideaId, id))
    .all();
}

function fetchSource(db: ReturnType<typeof getDb>, id: string) {
  return db
    .select({
      projectId: posts.id,
      projectName: posts.title,
      projectSlug: posts.slug,
      projectDescription: posts.body,
    })
    .from(projects)
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(projects.sourceIdeaId, id))
    .all();
}

export interface GetIdeaDetailOptions {
  /** コメントの親(スレッド)を何件取得するか。未指定なら全件 */
  commentsLimit?: number;
}

export async function getIdeaDetail(id: string, userId?: string, options: GetIdeaDetailOptions = {}) {
  const d1 = await getD1();
  const db = getDb(d1);

  const ideaData = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      content: posts.body,
      contentFormat: posts.bodyFormat,
      status: ideas.status,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      authorUsername: userProfiles.username,
    })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(eq(posts.kind, "idea"), or(eq(posts.slug, id), eq(posts.previousSlug, id))))
    .get();

  if (!ideaData) return null;

  // 以降は slug ではなく実体の id で引く
  const postId = ideaData.id;

  const [likesData, userLike] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.postId, postId)).get(),
    userId
      ? db.select().from(favorites).where(and(eq(favorites.postId, postId), eq(favorites.userId, userId))).get()
      : null,
  ]);

  const commentSelection = {
    id: commentsTable.id,
    content: commentsTable.content,
    contentFormat: commentsTable.contentFormat,
    createdAt: commentsTable.createdAt,
    updatedAt: commentsTable.updatedAt,
    parentId: commentsTable.parentId,
    authorId: commentsTable.authorId,
    authorName: userProfiles.displayName,
    authorAvatar: userProfiles.avatarUrl,
    authorUsername: userProfiles.username,
  };

  const [totalCommentThreadsResult, commentRoots] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(commentsTable)
      .where(and(eq(commentsTable.postId, postId), isNull(commentsTable.parentId)))
      .get(),
    db
      .select(commentSelection)
      .from(commentsTable)
      .innerJoin(users, eq(commentsTable.authorId, users.id))
      .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(eq(commentsTable.postId, postId), isNull(commentsTable.parentId)))
      .orderBy(desc(commentsTable.createdAt))
      .limit(options.commentsLimit ?? 20)
      .all(),
  ]);

  const totalCommentThreads = totalCommentThreadsResult?.count ?? 0;
  const rootIds = commentRoots.map((r) => r.id);
  const commentReplies = rootIds.length === 0 ? [] : await db
    .select(commentSelection)
    .from(commentsTable)
    .innerJoin(users, eq(commentsTable.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(inArray(commentsTable.parentId, rootIds))
    .orderBy(desc(commentsTable.createdAt))
    .all();

  const comments = [...commentRoots, ...commentReplies];

  const [linkedVersions, sourceIdeaProjects] = await Promise.all([
    fetchLinked(db, postId),
    fetchSource(db, postId),
  ]);

  const merged = mergeResolvedProjects(linkedVersions, sourceIdeaProjects);
  const projectIds = merged.map((p) => p.projectId);
  const projectDetails = await getProjectsByIds(projectIds, locale);

  const resolvedProjects = projectDetails.map((detail) => {
    const m = merged.find((p) => p.projectId === detail.id);
    return {
      ...detail,
      versionNumber: m?.versionNumber ?? null,
    };
  });

  return {
    ideaData,
    initialCount: likesData?.count || 0,
    initialLiked: !!userLike,
    comments,
    totalCommentThreads,
    resolvedProjects,
  };
}

export type IdeaDetail = NonNullable<Awaited<ReturnType<typeof getIdeaDetail>>>;
