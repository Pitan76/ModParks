import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, userSettings, userFollows, developerSubscriptions, profilePins, posts, projects, ideas, favorites, comments } from "@/db/schema";
import { eq, and, sql, inArray, desc, getTableColumns } from "drizzle-orm";
import { getProjectsWithCount, getUserProjectStats } from "@/lib/actions/projectQuery";
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

/**
 * ピン留めされた項目。
 *
 * project 側は mapProjectRow の戻り値だが、ジェネリクスの推論が効かず
 * ReturnType<typeof mapProjectRow> では著者情報だけの型に潰れてしまう。
 * 実際に組み立てている getPinnedItems の結果から型を取る。
 */
export type PinnedProject = Awaited<ReturnType<typeof getProjectsWithCount>>["data"][number];

export type PinnedItem =
  | { kind: "project"; project: PinnedProject }
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

  const { body, ...restPosts } = getTableColumns(posts);

  const [projectRows, ideaRows] = await Promise.all([
    projectIds.length
      ? db
          .select({
            project: {
              ...restPosts,
              ...getTableColumns(projects),
              body: sql<string>`SUBSTR(${posts.body}, 1, 1200) || CASE WHEN LENGTH(${posts.body}) > 1200 THEN '...' ELSE '' END`,
              tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = posts.id)`,
              latestVersionNumber: sql<string | null>`(SELECT version_number FROM versions WHERE project_id = posts.id AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1)`
            },
            author: {
              username: userProfiles.username,
              displayName: userProfiles.displayName,
              avatarUrl: userProfiles.avatarUrl,
            },
          })
          .from(posts)
          .innerJoin(projects, eq(projects.id, posts.id))
          .leftJoin(users, eq(posts.authorId, users.id))
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(
            isOwner
              ? inArray(posts.id, projectIds)
              : and(inArray(posts.id, projectIds), eq(posts.visibility, "public"))
          )
          .all()
      : Promise.resolve([]),
    ideaIds.length
      ? db
          .select(ideaSelection())
          .from(posts)
          .innerJoin(ideas, eq(ideas.id, posts.id))
          .innerJoin(users, eq(posts.authorId, users.id))
          .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(
            isOwner
              ? inArray(posts.id, ideaIds)
              : and(inArray(posts.id, ideaIds), eq(posts.visibility, "public"))
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
    id: posts.id,
    slug: posts.slug,
    title: posts.title,
    content: posts.body,
    status: ideas.status,
    createdAt: posts.createdAt,
    authorName: userProfiles.displayName,
    likesCount: sql<number>`(SELECT count(*) FROM ${favorites} WHERE ${favorites.postId} = ${posts.id})`,
    commentsCount: sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id})`,
  };
}

export type AuthorIdea = Awaited<ReturnType<typeof getAuthorIdeas>>[number];

/** プロフィール主が投稿したアイデア一覧。公開のみ（本人が見る場合は下書き等も含む）。 */
async function getAuthorIdeas(userId: string, isOwner: boolean, limit: number, offset: number) {
  const d1 = await getD1();
  const db = getDb(d1);

  return db
    .select(ideaSelection())
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(
      isOwner
        ? eq(posts.authorId, userId)
        : and(eq(posts.authorId, userId), eq(posts.visibility, "public"))
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
}

/** getAuthorIdeas と同じ絞り込みで、該当件数のみを取得する */
async function countAuthorIdeas(userId: string, isOwner: boolean): Promise<number> {
  const d1 = await getD1();
  const db = getDb(d1);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .where(
      isOwner
        ? eq(posts.authorId, userId)
        : and(eq(posts.authorId, userId), eq(posts.visibility, "public"))
    )
    .get();

  return result?.count ?? 0;
}

type ListArgs = { limit: number; offset: number; sort: string; ideasLimit: number; ideasOffset: number; locale: string };

/** プロフィール表示に必要なフォロー状態・プロジェクト・お気に入り・コレクション・統計を集約する。 */
export async function getProfileContent(user: ProfileUser, viewerId: string | undefined, isOwner: boolean, { limit, offset, sort, ideasLimit, ideasOffset, locale }: ListArgs) {
  const followState = await getFollowState(user.id, viewerId, isOwner);

  // 投稿アイデア表示は既定 ON。custom.showIdeasOnProfile が false のときのみ非表示。
  const showIdeas = ((user.custom as Record<string, any>)?.showIdeasOnProfile ?? true) !== false;
  const canSeeIdeas = showIdeas || isOwner;

  const [{ data: allProjects, totalCount }, favoritedProjects, userCollections, stats, pinnedItems, authorIdeas, totalIdeaCount] = await Promise.all([
    getProjectsWithCount({ authorId: user.id, limit, offset, sort: sort as any, locale }),
    getFavoriteProjects(user.id),
    getUserCollections(user.id, viewerId),
    getUserProjectStats(user.id),
    getPinnedItems(user.id, isOwner),
    // 非表示設定でも本人は編集用に一覧を見られるようにする
    canSeeIdeas ? getAuthorIdeas(user.id, isOwner, ideasLimit, ideasOffset) : Promise.resolve([] as AuthorIdea[]),
    canSeeIdeas ? countAuthorIdeas(user.id, isOwner) : Promise.resolve(0),
  ]);

  const visibleProjects = allProjects.filter((p) => (isOwner ? true : p.visibility === "public"));

  return {
    ...followState,
    totalCount,
    favoritedProjects,
    userCollections,
    stats,
    visibleProjects,
    pinnedItems,
    authorIdeas,
    totalIdeaCount,
    showIdeas,
    displayTotalProjects: isOwner ? totalCount : stats.totalProjects,
  };
}
