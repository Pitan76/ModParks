import { getDatabase } from "@/lib/db";
import { getUserProjectStats } from "@/lib/actions/projectQuery";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { projects, projectComments, users, userProfiles, ideas } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";

/** ダッシュボード表示に必要なユーザー固有データを一括取得する。 */
export async function getDashboardData(userId: string) {
  const db = await getDatabase();

  const stats = await getUserProjectStats(userId);
  const favorites = await getFavoriteProjects(userId);

  const [commentsCountResult] = await db
    .select({ value: count() })
    .from(projectComments)
    .innerJoin(projects, eq(projectComments.projectId, projects.id))
    .where(eq(projects.authorId, userId));

  const latestComments = await db
    .select({
      id: projectComments.id,
      content: projectComments.content,
      createdAt: projectComments.createdAt,
      projectName: projects.name,
      projectSlug: projects.slug,
      authorName: userProfiles.displayName,
      authorUsername: userProfiles.username,
    })
    .from(projectComments)
    .innerJoin(projects, eq(projectComments.projectId, projects.id))
    .innerJoin(users, eq(projectComments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(projects.authorId, userId))
    .orderBy(desc(projectComments.createdAt))
    .limit(5);

  const recentProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.authorId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(5);

  const myIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.authorId, userId))
    .orderBy(desc(ideas.createdAt))
    .limit(5);

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
