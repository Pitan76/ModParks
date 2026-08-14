import { getDatabase } from "@/lib/db";
import { getUserProjectStats } from "@/lib/actions/projectQuery";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { posts, projects, comments, users, userProfiles, ideas } from "@/db/schema";
import { toProjectPost, toIdeaPost } from "@/lib/queries/postRow";
import { eq, and, desc, count } from "drizzle-orm";

/** ダッシュボード表示に必要なユーザー固有データを一括取得する。 */
export async function getDashboardData(userId: string, locale: string) {
  const db = await getDatabase();

  const stats = await getUserProjectStats(userId);
  const favorites = await getFavoriteProjects(userId, locale);

  const [commentsCountResult] = await db
    .select({ value: count() })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(eq(posts.kind, "project"), eq(posts.authorId, userId)));

  const latestCommentRows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      projectTitle: posts.title,
      projectSlug: posts.slug,
      authorName: userProfiles.displayName,
      authorUsername: userProfiles.username,
    })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(eq(posts.kind, "project"), eq(posts.authorId, userId)))
    .orderBy(desc(comments.createdAt))
    .limit(5);

  const latestComments = latestCommentRows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    projectName: row.projectTitle,
    projectSlug: row.projectSlug,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
  }));

  const recentProjectRows = await db
    .select({ posts: posts, projects: projects })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .where(and(eq(posts.kind, "project"), eq(posts.authorId, userId)))
    .orderBy(desc(posts.updatedAt))
    .limit(5)
    .all();

  const recentProjects = recentProjectRows.map(toProjectPost);

  const myIdeaRows = await db
    .select({ posts: posts, ideas: ideas })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .where(and(eq(posts.kind, "idea"), eq(posts.authorId, userId)))
    .orderBy(desc(posts.createdAt))
    .limit(5)
    .all();

  const myIdeas = myIdeaRows.map(toIdeaPost);

  return {
    stats,
    favorites,
    topFavorites: favorites.slice(0, 5),
    totalComments: commentsCountResult.value,
    latestComments,
    recentProjects,
    myIdeas,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
