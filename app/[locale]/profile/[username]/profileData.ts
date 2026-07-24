import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, userSettings, userFollows, developerSubscriptions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getProjects, getUserProjectStats } from "@/lib/actions/projectQuery";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { getUserCollections } from "@/lib/actions/collection";

export async function getProfileMeta(username: string) {
  const d1 = await getD1();
  const db = getDb(d1);
  return db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      bio: userProfiles.bio,
      avatarUrl: userProfiles.avatarUrl,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(userProfiles.username, username))
    .get();
}

function fetchProfileUser(db: ReturnType<typeof getDb>, username: string) {
  return db
    .select({
      id: users.id,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      bio: userProfiles.bio,
      links: userProfiles.links,
      githubUsername: userProfiles.githubUsername,
      custom: userSettings.custom,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(userSettings, eq(users.id, userSettings.userId))
    .where(eq(userProfiles.username, username))
    .get();
}

export type ProfileUser = NonNullable<Awaited<ReturnType<typeof fetchProfileUser>>>;

/** ユーザー本体を取得。旧ユーザー名で見つかった場合はリダイレクト先を返す。 */
export async function resolveProfileUser(
  username: string
): Promise<{ user: ProfileUser } | { redirectTo: string } | null> {
  const d1 = await getD1();
  const db = getDb(d1);

  const user = await fetchProfileUser(db, username);
  if (user) return { user };

  const prevUser = await db
    .select({ username: userProfiles.username })
    .from(userProfiles)
    .where(eq(userProfiles.previousUsername, username))
    .get();

  if (prevUser?.username) return { redirectTo: prevUser.username };
  return null;
}

async function getFollowState(userId: string, viewerId: string | undefined, isOwner: boolean) {
  const d1 = await getD1();
  const db = getDb(d1);

  const [followersData, followingData] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followingId, userId)).get(),
    db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followerId, userId)).get(),
  ]);

  let isFollowing = false;
  let isSubscribed = false;
  if (viewerId && !isOwner) {
    const [followRecord, subRecord] = await Promise.all([
      db.select().from(userFollows).where(and(eq(userFollows.followerId, viewerId), eq(userFollows.followingId, userId))).get(),
      db.select().from(developerSubscriptions).where(and(eq(developerSubscriptions.subscriberId, viewerId), eq(developerSubscriptions.developerId, userId))).get(),
    ]);
    isFollowing = !!followRecord;
    isSubscribed = !!subRecord;
  }

  return {
    followersCount: followersData?.count || 0,
    followingCount: followingData?.count || 0,
    isFollowing,
    isSubscribed,
  };
}

type ListArgs = { limit: number; offset: number; sort: string };

/** プロフィール表示に必要なフォロー状態・プロジェクト・お気に入り・コレクション・統計を集約する。 */
export async function getProfileContent(user: ProfileUser, viewerId: string | undefined, isOwner: boolean, { limit, offset, sort }: ListArgs) {
  const followState = await getFollowState(user.id, viewerId, isOwner);

  const [{ data: allProjects, totalCount }, favoritedProjects, userCollections, stats] = await Promise.all([
    getProjects({ authorId: user.id, limit, offset, sort: sort as any, calculateTotal: true }),
    getFavoriteProjects(user.id),
    getUserCollections(user.id, viewerId),
    getUserProjectStats(user.id),
  ]);

  const visibleProjects = allProjects.filter((p) => (isOwner ? true : p.status === "public"));

  return {
    ...followState,
    totalCount,
    favoritedProjects,
    userCollections,
    stats,
    visibleProjects,
    displayTotalProjects: isOwner ? totalCount : stats.totalProjects,
  };
}
