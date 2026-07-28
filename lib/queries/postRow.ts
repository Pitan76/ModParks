import type { Post, ProjectFields, IdeaFields } from "@/db/schema";
import type { ProjectPost, IdeaPost, PostAuthor } from "@/types/post";

/**
 * posts と子テーブルを join した行を、平坦なドメインオブジェクトに直す。
 *
 * Drizzle の join は { posts: {...}, projects: {...} } というネストした形を返す。
 * この形をクエリ層の外へ出すと、上位のコードが row.posts.title と書くことになり、
 * DB の保存都合がドメイン層へ漏れる。平坦化はここで完了させる。
 *
 * 設計の背景は docs-md/DESIGN.md の「平坦化はクエリ層で完了させる」を参照。
 */

/** 子テーブルの id は posts.id と同じ値なので落とす */
const dropChildId = <T extends { id: string }>(child: T): Omit<T, "id"> => {
  const { id: _id, ...rest } = child;
  return rest;
};

export const toProjectPost = (row: {
  posts: Post;
  projects: ProjectFields;
}): ProjectPost => ({
  ...row.posts,
  kind: "project",
  ...dropChildId(row.projects),
});

export const toIdeaPost = (row: {
  posts: Post;
  ideas: IdeaFields;
}): IdeaPost => ({
  ...row.posts,
  kind: "idea",
  ...dropChildId(row.ideas),
});

/**
 * join で引いた投稿者情報を PostAuthor に整える。
 * user_profiles が無いユーザーは表示上ありえないが、left join の型に合わせて許容する。
 */
export const toPostAuthor = (row: {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}): PostAuthor => ({
  id: row.id,
  username: row.username ?? "",
  displayName: row.displayName ?? row.username,
  avatarUrl: row.avatarUrl,
});
