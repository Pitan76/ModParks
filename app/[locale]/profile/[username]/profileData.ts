import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, userSettings, userFollows, developerSubscriptions, profilePins, projects, ideas, ideaLikes, ideaComments } from "@/db/schema";
import { eq, and, sql, inArray, desc, getTableColumns } from "drizzle-orm";
import { getProjects, getUserProjectStats } from "@/lib/actions/projectQuery";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { getUserCollections } from "@/lib/actions/collection";
import { mapProjectRow } from "@/lib/queries/projectRow";

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
      deactivatedAt: users.deactivatedAt,
      suspendedAt: users.suspendedAt,
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
      deactivatedAt: users.deactivatedAt,
      suspendedAt: users.suspendedAt,
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

export type PinnedItem =
  | { kind: "project"; project: ReturnType<typeof mapProjectRow> }
  | { kind: "idea"; idea: AuthorIdea };

/** プロフィールにピン留めされたプロジェクト/アイデアを、ピンの並び順で解決する。 */
async function getPinnedItems(userId: string, isOwner: boolean): Promise<PinnedItem[]> {
  const d1 = await getD1();
  const db = getDb(d1);

  const pins = await db
    .select({ itemType: profilePins.itemType, itemId: profilePins.itemId })
    .from(profilePins)
    .where(eq(profilePins.userId, userId))
    .orderBy(profilePins.sortOrder)
    .all();

  if (pins.length === 0) return [];

  const projectIds = pins.filter((p) => p.itemType === "project").map((p) => p.itemId);
  const ideaIds = pins.filter((p) => p.itemType === "idea").map((p) => p.itemId);

  const { description, ...restProjects } = getTableColumns(projects);

  const [projectRows, ideaRows] = await Promise.all([
    projectIds.length
      ? db
          .select({
            project: {
              ...restProjects,
              description: sql<string>`SUBSTR(${projects.description}, 1, 1200) || CASE WHEN LENGTH(${projects.description}) > 1200 THEN '...' ELSE '' END`,
              tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = projects.id)`,
            },
            author: {
              username: userProfiles.username,
              displayName: userProfiles.displayName,
              avatarUrl: userProfiles.avatarUrl,
            },
          })
          .from(projects)
          .leftJoin(users, eq(projects.authorId, users.id))
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(
            isOwner
              ? inArray(projects.id, projectIds)
              : and(inArray(projects.id, projectIds), eq(projects.status, "public"))
          )
          .all()
      : Promise.resolve([]),
    ideaIds.length
      ? db
          .select(ideaSelection())
          .from(ideas)
          .innerJoin(users, eq(ideas.authorId, users.id))
          .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(
            isOwner
              ? inArray(ideas.id, ideaIds)
              : and(inArray(ideas.id, ideaIds), eq(ideas.visibility, "public"))
          )
          .all()
      : Promise.resolve([]),
  ]);

  const projectMap = new Map(projectRows.map((r) => [r.project.id, mapProjectRow(r)]));
  const ideaMap = new Map(ideaRows.map((r) => [r.id, r]));

  const result: PinnedItem[] = [];
  for (const pin of pins) {
    if (pin.itemType === "project") {
      const p = projectMap.get(pin.itemId);
      if (p) result.push({ kind: "project", project: p });
    } else {
      const i = ideaMap.get(pin.itemId);
      if (i) result.push({ kind: "idea", idea: i });
    }
  }
  return result;
}

function ideaSelection() {
  return {
    id: ideas.id,
    title: ideas.title,
    content: ideas.content,
    status: ideas.status,
    createdAt: ideas.createdAt,
    authorName: userProfiles.displayName,
    likesCount: sql<number>`(SELECT count(*) FROM ${ideaLikes} WHERE ${ideaLikes.ideaId} = ${ideas.id})`,
    commentsCount: sql<number>`(SELECT count(*) FROM ${ideaComments} WHERE ${ideaComments.ideaId} = ${ideas.id})`,
  };
}

export type AuthorIdea = Awaited<ReturnType<typeof getAuthorIdeas>>[number];

/** プロフィール主が投稿したアイデア一覧。公開のみ（本人が見る場合は下書き等も含む）。 */
async function getAuthorIdeas(userId: string, isOwner: boolean) {
  const d1 = await getD1();
  const db = getDb(d1);

  return db
    .select(ideaSelection())
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(
      isOwner
        ? eq(ideas.authorId, userId)
        : and(eq(ideas.authorId, userId), eq(ideas.visibility, "public"))
    )
    .orderBy(desc(ideas.createdAt))
    .limit(30)
    .all();
}

type ListArgs = { limit: number; offset: number; sort: string };

/** プロフィール表示に必要なフォロー状態・プロジェクト・お気に入り・コレクション・統計を集約する。 */
export async function getProfileContent(user: ProfileUser, viewerId: string | undefined, isOwner: boolean, { limit, offset, sort }: ListArgs) {
  const followState = await getFollowState(user.id, viewerId, isOwner);

  // 投稿アイデア表示は既定 ON。custom.showIdeasOnProfile が false のときのみ非表示。
  const showIdeas = ((user.custom as Record<string, any>)?.showIdeasOnProfile ?? true) !== false;

  const [{ data: allProjects, totalCount }, favoritedProjects, userCollections, stats, pinnedItems, authorIdeas] = await Promise.all([
    getProjects({ authorId: user.id, limit, offset, sort: sort as any, calculateTotal: true }),
    getFavoriteProjects(user.id),
    getUserCollections(user.id, viewerId),
    getUserProjectStats(user.id),
    getPinnedItems(user.id, isOwner),
    // 非表示設定でも本人は編集用に一覧を見られるようにする
    showIdeas || isOwner ? getAuthorIdeas(user.id, isOwner) : Promise.resolve([] as AuthorIdea[]),
  ]);

  const visibleProjects = allProjects.filter((p) => (isOwner ? true : p.status === "public"));

  return {
    ...followState,
    totalCount,
    favoritedProjects,
    userCollections,
    stats,
    visibleProjects,
    pinnedItems,
    authorIdeas,
    showIdeas,
    displayTotalProjects: isOwner ? totalCount : stats.totalProjects,
  };
}
