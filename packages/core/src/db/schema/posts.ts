/**
 * Project / Idea の共通基底となる投稿テーブル群。
 * 詳細な設計意図は docs-md/DESIGN.md を参照。
 */
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

/**
 * ユーザーが作成する投稿の共通部分。Project と Idea はこのテーブルを継承する
 * （Class Table Inheritance）。`projects.id` / `ideas.id` が `posts.id` を参照し、
 * 1 つの投稿は「posts の 1 行 + 子テーブルの 1 行」で構成される。
 */
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * 投稿の種別。子テーブルのどちらに対応行があるかで導出できる冗長な値だが、
   * 一覧クエリを索引で引くために持つ。作成時に子テーブルと同時に書き、以後更新しない。
   */
  kind: text("kind", { enum: ["project", "idea"] }).notNull(),
  /** URL 識別子。Idea は作成時 id と同じランダム値を入れ、作者が後から変更できる */
  slug: text("slug").notNull(),
  /** 変更前の slug。旧 URL からのリダイレクトに使う */
  previousSlug: text("previous_slug"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  bodyFormat: text("body_format", { enum: ["markdown", "plaintext", "pukiwiki"] })
    .notNull()
    .default("markdown"),
  /**
   * title / body が書かれている言語。多言語表示の起点になる。
   * 訳文は post_translations 側にのみ持ち、このロケールの行は作らない。
   */
  sourceLocale: text("source_locale").notNull().default("ja"),
  /**
   * 閲覧者主導の AI 翻訳を許可するか。既定は許可。
   * 訳文の品質を作者が管理したい場合や、機械翻訳を望まない場合に落とす。
   */
  aiTranslationEnabled: integer("ai_translation_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /** 公開範囲。旧 projects.status / ideas.visibility を統合したもの */
  visibility: text("visibility", { enum: ["draft", "public", "unlisted", "private"] })
    .notNull()
    .default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  // slug は種別ごとに一意。Idea 発の Project が同じ slug を名乗れるようにする
  slugUnique: uniqueIndex("posts_kind_slug_unique").on(t.kind, t.slug),
  previousSlugUnique: uniqueIndex("posts_kind_previous_slug_unique").on(t.kind, t.previousSlug),
  authorIdx: index("posts_author_idx").on(t.authorId),
  // 一覧は「種別 + 公開範囲」で絞って新しい順に並べる
  kindVisibilityCreatedIdx: index("posts_kind_visibility_created_idx")
    .on(t.kind, t.visibility, t.createdAt),
  updatedAtIdx: index("posts_updated_at_idx").on(t.updatedAt),
}));

/** 旧 project_comments / idea_comments を統合したもの */
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 返信先の親コメントID（1階層のみ）。トップレベルなら null */
  parentId: text("parent_id"),
  content: text("content").notNull(),
  contentFormat: text("content_format", { enum: ["markdown", "plaintext", "pukiwiki"] })
    .notNull()
    .default("markdown"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  postIdx: index("comments_post_idx").on(t.postId),
  authorIdx: index("comments_author_idx").on(t.authorId),
}));

/**
 * 旧 project_favorites / idea_likes を統合したもの。
 * 「いいね」と「ブックマーク」は区別せず、すべて「お気に入り」として扱う。
 */
export const favorites = sqliteTable("favorites", {
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.userId] }),
  postIdx: index("favorites_post_idx").on(t.postId),
  userIdx: index("favorites_user_idx").on(t.userId),
}));

/**
 * posts の行。単体の Post は投稿として完結しており、共通処理はこの型で書ける。
 * Project / Idea として扱うときは types/post.ts の ProjectPost / IdeaPost を使う。
 */
export type Post     = typeof posts.$inferSelect;
export type Comment  = typeof comments.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
