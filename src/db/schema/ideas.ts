/** Idea 固有のテーブル。共通部分は posts が持つ */
import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";
import { posts } from "./posts";
import { versions } from "./versions";

/**
 * Idea 固有の情報。共通部分は posts が持つ。
 * 現状 status のみだが、Idea 固有の項目を足す場所として独立させておく。
 */
export const ideas = sqliteTable("ideas", {
  id:          text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  status:      text("status", { enum: ["open", "in_progress", "fulfilled"] }).notNull().default("open"),
  /** JSON: string[] - 対応 MC バージョン */
  mcVersions:  text("mc_versions"),
  /** JSON: string[] - 対応ローダー */
  loaders:     text("loaders"),
}, (table) => ({
  statusIdx: index("ideas_status_idx").on(table.status),
}));

export const ideaTags = sqliteTable(
  "idea_tags",
  {
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ideaId, t.tag] }),
    index("idea_tags_idea_idx").on(t.ideaId),
  ]
);

/** バージョンがどの Idea を実現したかの紐付け */
export const versionIdeas = sqliteTable(
  "version_ideas",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.ideaId] }),
    versionIdx: index("version_ideas_version_idx").on(t.versionId),
    ideaIdx: index("version_ideas_idea_idx").on(t.ideaId),
  })
);

/** ideas の行。ProjectFields と同じ理由で、単体で Idea を表さない */
export type IdeaFields = typeof ideas.$inferSelect;
export type IdeaTag = typeof ideaTags.$inferSelect;
