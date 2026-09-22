/**
 * 投稿本文の多言語化。設計の全体像は memo/AI_TRANSLATION_DESIGN.md を参照。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { posts, comments } from "./posts";
import { users } from "./auth";

/**
 * 原文以外のロケールの訳文。行が存在しないことが「未翻訳」を意味する。
 * 言語を増やしてもマイグレーションが不要になるよう、言語ごとカラムではなく行で持つ。
 */
export const postTranslations = sqliteTable("post_translations", {
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  /** AppLocale。posts.sourceLocale と同じ値の行は作らない */
  locale: text("locale").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** 原文と常に同一。訳出時に形式変換はしないため、描画経路を原文と共通化できる */
  bodyFormat: text("body_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull(),
  /** cached = AI 生成のまま / manual = 作者が確定済み。manual は自動で上書きしない */
  state: text("state", { enum: ["cached", "manual"] }).notNull(),
  /** 翻訳元とした原文のハッシュ。現在の原文と比較して stale を判定する */
  sourceHash: text("source_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.locale] }),
  // 一覧は表示ロケールで LEFT JOIN するため、locale 側から引ける索引を持つ
  localeIdx: index("post_translations_locale_idx").on(t.locale),
}));

/**
 * LLM を実際に呼び出した記録。コスト異常時の追跡と、失敗直後の連続実行抑制に使う。
 * キャッシュヒットは LLM を経由しないため記録しない。
 */
export const translationRuns = sqliteTable("translation_runs", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  /**
   * コメントを訳した場合だけ入る。失敗直後の抑制をコメント単位で効かせるため。
   * 外部キーは張らない。SQLite の ALTER では ON DELETE を付けられず、張るとコメントを消せなくなる
   */
  commentId: text("comment_id"),
  locale: text("locale").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 使用したプロバイダとモデル。差し替え後にコストを比較できるように残す */
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  /** マスク後の文字数。上限判定もこの値で行う */
  inputChars: integer("input_chars").notNull(),
  outputChars: integer("output_chars").notNull(),
  /** invalid_output = 記法検証に失敗し訳文を破棄した */
  status: text("status", { enum: ["ok", "invalid_output", "error"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  // レート制限と予算集計はどちらも「期間 + 主体」で引く
  userCreatedIdx: index("translation_runs_user_created_idx").on(t.userId, t.createdAt),
  postLocaleCreatedIdx: index("translation_runs_post_locale_created_idx")
    .on(t.postId, t.locale, t.createdAt),
  createdIdx: index("translation_runs_created_idx").on(t.createdAt),
}));

/**
 * コメントの訳文（AI 生成のみ）。コメントには原文の言語の欄も手動訳の概念も無いため、
 * post_translations とは分けて最小限の列だけ持つ。原文の言語は表示のたびに本文から推定する。
 */
export const commentTranslations = sqliteTable("comment_translations", {
  commentId: text("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  body: text("body").notNull(),
  /** 原文と同一。描画経路を原文と共通化するため */
  bodyFormat: text("body_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull(),
  /** 翻訳元とした原文のハッシュ。コメントが編集されたら訳し直す */
  sourceHash: text("source_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  pk: primaryKey({ columns: [t.commentId, t.locale] }),
}));

export type CommentTranslation = typeof commentTranslations.$inferSelect;
export type PostTranslation = typeof postTranslations.$inferSelect;
export type TranslationRun  = typeof translationRuns.$inferSelect;
