/**
 * Post に対するコメントの取得・投稿。
 *
 * URLは /projects/{slug}/comments と /ideas/{slug}/comments を別々に持つが
 * （利用者が知っているのは Project/Idea の slug であり Post ID ではないため）、
 * 実装はここに1本化する。ProjectとIdeaで別々のコメント処理を持たない。
 * 詳細は docs-md/DESIGN.md の「URLはpostsに寄せない」を参照。
 */
import { comments, users, userProfiles } from "@/db/schema";
import { eq, desc, and, isNull, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { ApiComment } from "@/types/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

const commentSelection = {
  id: comments.id,
  content: comments.content,
  contentFormat: comments.contentFormat,
  parentId: comments.parentId,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  authorUsername: userProfiles.username,
  authorDisplayName: userProfiles.displayName,
  authorAvatarUrl: userProfiles.avatarUrl,
};

function toApiComment(r: any): ApiComment {
  return {
    id: r.id,
    content: r.content,
    contentFormat: r.contentFormat,
    parentId: r.parentId,
    author: { username: r.authorUsername, displayName: r.authorDisplayName, avatarUrl: r.authorAvatarUrl },
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : 0,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
  };
}

export interface ListPostCommentsParams {
  /** 親コメント(スレッドの起点)を何件取得するか */
  limit?: number;
  offset?: number;
}

/**
 * 投稿へのコメントを取得する。
 *
 * 返信は親コメントに従属して表示されるため、ページングは親コメント単位で行う。
 * 指定した offset/limit で親コメントを絞り込み、その返信は全件まとめて返す
 * （1スレッドの返信数は現実的な範囲に収まる想定のため）。
 */
export async function listPostComments(
  db: Db,
  postId: string,
  params: ListPostCommentsParams = {},
): Promise<ApiComment[]> {
  const { limit, offset = 0 } = params;

  let rootQuery = db
    .select(commentSelection)
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(eq(comments.postId, postId), isNull(comments.parentId)))
    .orderBy(desc(comments.createdAt))
    .offset(offset);
  if (limit !== undefined) rootQuery = rootQuery.limit(limit);

  const roots = await rootQuery.all();
  if (roots.length === 0) return [];

  const rootIds = roots.map((r: any) => r.id);
  const replies = await db
    .select(commentSelection)
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(inArray(comments.parentId, rootIds))
    .orderBy(desc(comments.createdAt))
    .all();

  return [...roots, ...replies].map(toApiComment);
}

/** 投稿の親コメント(スレッド)の総数を取得する */
export async function countPostRootComments(db: Db, postId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.parentId)))
    .get();
  return result?.count ?? 0;
}

export interface CreatePostCommentResult {
  id: string;
  parentAuthorId: string | null;
}

/**
 * コメントを作成する。返信は1階層のみ（親が返信自身なら親コメントに付け替える）。
 * 通知の送信は呼び出し側（kind ごとに payload.kind を出し分けたいため）で行う。
 */
export async function createPostComment(
  db: Db,
  postId: string,
  authorId: string,
  input: { content: string; parentId?: string | null; contentFormat?: string },
): Promise<CreatePostCommentResult> {
  const content = input.content.trim();

  let normalizedParentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (input.parentId) {
    const parent = await db
      .select({ id: comments.id, authorId: comments.authorId, parentId: comments.parentId })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.postId, postId)))
      .get();
    if (parent) {
      normalizedParentId = parent.parentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }
  }

  const { userSettings } = await import("@/db/schema");
  const settingsRecord = await db.select({ defaultCommentBodyFormat: userSettings.defaultCommentBodyFormat }).from(userSettings).where(eq(userSettings.userId, authorId)).get();
  const defaultFormat = settingsRecord?.defaultCommentBodyFormat || "markdown";

  const format = (["markdown", "plaintext", "pukiwiki"].includes(input.contentFormat || "")
    ? input.contentFormat
    : defaultFormat) as "markdown" | "plaintext" | "pukiwiki";

  const id = createId();
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    parentId: normalizedParentId,
    content,
    contentFormat: format,
  }).run();

  return { id, parentAuthorId };
}
