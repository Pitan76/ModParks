import { eq, and, or, sql, desc, inArray, type SQL } from "drizzle-orm";
import { posts, projects, ideas, users, userProfiles, favorites, comments, projectTags } from "@/db/schema";
import type { IdeaPostView, ProjectPostView } from "@/types/post";

/**
 * 投稿一覧の取得。表示に必要な形（PostView）まで組み立てて返す。
 *
 * 一覧を出す画面が複数あるため、select の形をここに集約する。
 * 画面ごとに書くと、同じ「アイデア一覧」でも列や件数の数え方がずれていく。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/** PostView の共通部分。author と集計値は posts の行に無いので join / 相関副問い合わせで補う */
function postViewSelection(viewerId: string | null) {
  return {
    author: {
      id: users.id,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    },
    favoriteCount: sql<number>`(SELECT count(*) FROM ${favorites} WHERE ${favorites.postId} = ${posts.id})`,
    commentCount: sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id})`,
    isFavorited: viewerId
      ? sql<number>`EXISTS (SELECT 1 FROM ${favorites} WHERE ${favorites.postId} = ${posts.id} AND ${favorites.userId} = ${viewerId})`
      : sql<number>`0`,
  };
}

export interface ListIdeaPostsParams {
  /** 閲覧者。自分の非公開投稿を含めるかの判定と isFavorited に使う */
  viewerId?: string | null;
  /** 指定すると、この作者の投稿だけに絞る */
  authorId?: string;
  /** 指定した投稿IDだけに絞る（ピン留めなど） */
  postIds?: string[];
  /** 非公開・下書きも含める。本人・管理者向け */
  includeHidden?: boolean;
  limit?: number;
}

/**
 * アイデア一覧を IdeaPostView[] で返す。
 *
 * 公開範囲の絞り込みはここ（行レベル）で行う。取得してから捨てる形にすると
 * 漏れの原因になるため、非公開の投稿はそもそも結果に含めない。
 */
export async function listIdeaPosts(
  db: Db,
  params: ListIdeaPostsParams = {},
): Promise<IdeaPostView[]> {
  const { viewerId = null, authorId, postIds, includeHidden = false, limit = 50 } = params;

  const conditions: SQL[] = [eq(posts.kind, "idea")];

  if (!includeHidden) {
    // 自分の投稿は非公開でも見える
    conditions.push(
      viewerId
        ? or(eq(posts.visibility, "public"), eq(posts.authorId, viewerId))!
        : eq(posts.visibility, "public"),
    );
  }
  if (authorId) conditions.push(eq(posts.authorId, authorId));
  if (postIds) {
    if (postIds.length === 0) return [];
    conditions.push(inArray(posts.id, postIds));
  }

  const rows = await db
    .select({
      post: posts,
      idea: ideas,
      ...postViewSelection(viewerId),
    })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .all();

  return rows.map((row: any) => ({
    ...row.post,
    kind: "idea" as const,
    status: row.idea.status,
    author: {
      id: row.author.id,
      username: row.author.username ?? "",
      displayName: row.author.displayName ?? row.author.username,
      avatarUrl: row.author.avatarUrl,
    },
    favoriteCount: Number(row.favoriteCount ?? 0),
    commentCount: Number(row.commentCount ?? 0),
    isFavorited: Boolean(row.isFavorited),
  }));
}

export interface ListProjectPostsParams {
  viewerId?: string | null;
  authorId?: string;
  postIds?: string[];
  /** 非公開・下書きも含める。本人・管理者向け */
  includeHidden?: boolean;
  limit?: number;
}

/**
 * プロジェクト一覧を ProjectPostView[] で返す。listIdeaPosts と対になる関数。
 * 公開範囲の絞り込みは行レベル（クエリの WHERE）で行う。
 */
/** tags は project_tags という別テーブルの集計であり ProjectPostView の列ではないため、拡張して返す */
export type ProjectPostViewWithTags = ProjectPostView & { tags: string[] };

export async function listProjectPosts(
  db: Db,
  params: ListProjectPostsParams = {},
): Promise<ProjectPostViewWithTags[]> {
  const { viewerId = null, authorId, postIds, includeHidden = false, limit = 50 } = params;

  const conditions: SQL[] = [eq(posts.kind, "project")];

  if (!includeHidden) {
    conditions.push(
      viewerId
        ? or(eq(posts.visibility, "public"), eq(posts.authorId, viewerId))!
        : eq(posts.visibility, "public"),
    );
  }
  if (authorId) conditions.push(eq(posts.authorId, authorId));
  if (postIds) {
    if (postIds.length === 0) return [];
    conditions.push(inArray(posts.id, postIds));
  }

  const rows = await db
    .select({
      post: posts,
      project: projects,
      ...postViewSelection(viewerId),
      tagsJson: sql<string>`(SELECT json_group_array(tag) FROM ${projectTags} WHERE ${projectTags.projectId} = ${posts.id})`,
    })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .all();

  return rows.map((row: any) => {
    const { id: _childId, ...projectFields } = row.project;
    let tags: string[] = [];
    try {
      const parsed = JSON.parse(row.tagsJson ?? "[]");
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] !== null) tags = parsed;
    } catch {}

    return {
      ...row.post,
      kind: "project" as const,
      ...projectFields,
      tags,
      author: {
        id: row.author.id,
        username: row.author.username ?? "",
        displayName: row.author.displayName ?? row.author.username,
        avatarUrl: row.author.avatarUrl,
      },
      favoriteCount: Number(row.favoriteCount ?? 0),
      commentCount: Number(row.commentCount ?? 0),
      isFavorited: Boolean(row.isFavorited),
    };
  });
}
