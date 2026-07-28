import type { Post, ProjectFields, IdeaFields, Comment } from "@/db/schema";

/**
 * Project / Idea のドメイン型。
 *
 * DB では posts + projects / posts + ideas の 2 行に分かれているが、
 * アプリが扱う 1 つの投稿はこの合成型にあたる。
 * 設計の背景は docs-md/DESIGN.md を参照。
 */

/** 子側の id は posts.id と同じ値なので落とす */
export type ProjectPost = Post & { kind: "project" } & Omit<ProjectFields, "id">;
export type IdeaPost = Post & { kind: "idea" } & Omit<IdeaFields, "id">;

/**
 * kind による判別可能ユニオン。
 * post.kind で分岐すると、TypeScript が自動で ProjectPost / IdeaPost に絞り込む。
 */
export type AnyPost = ProjectPost | IdeaPost;

export function isProjectPost(p: AnyPost): p is ProjectPost {
  return p.kind === "project";
}

export function isIdeaPost(p: AnyPost): p is IdeaPost {
  return p.kind === "idea";
}

/** 表示に必要な投稿者情報。posts の行には無いので JOIN で補う */
export interface PostAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * 画面表示用の投稿。集計値と投稿者を含む。
 * PostView<ProjectPost> と書けば Project 専用、素の PostView なら両方を受け取れる。
 */
export type PostView<T extends AnyPost = AnyPost> = T & {
  author: PostAuthor;
  favoriteCount: number;
  commentCount: number;
  /** 閲覧者がお気に入り登録済みか。未ログインなら false */
  isFavorited: boolean;
};

export type ProjectPostView = PostView<ProjectPost>;
export type IdeaPostView = PostView<IdeaPost>;

/** 表示用のコメント。返信を子として畳み込んだ形 */
export type CommentView = Comment & {
  author: PostAuthor;
  replies: CommentView[];
};
