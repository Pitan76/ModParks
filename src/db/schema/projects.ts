/**
 * Project 本体と、プロジェクト単位で持つ付随テーブル
 * （カテゴリ・タグ・メンバー・メディア）。
 *
 * バージョン・依存関係・レシピ表示設定はそれぞれ
 * ./versions, ./projectDependencies, ./projectRecipes に分けている。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { posts } from "./posts";
import { CONTENT_TYPES } from "../../lib/data/projectTypes";
import type { RecipeSettings } from "../../lib/recipe/settings";

/**
 * Project 固有の情報。共通部分（title / body / slug / visibility / author / 日時）は
 * posts が持つ。単体では投稿として成立しないため、必ず posts と JOIN して使う。
 */
export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  iconUrl: text("icon_url"),
  type: text("type", { enum: CONTENT_TYPES }).notNull(),
  license: text("license").notNull(),
  sourceUrl: text("source_url"),
  links: text("links"),
  downloads: integer("downloads").notNull().default(0),
  modrinthId: text("modrinth_id"),
  curseforgeId: text("curseforge_id"),
  issueTrackerUrl: text("issue_tracker_url"),
  totalDownloads: integer("total_downloads").notNull().default(0),
  externalDownloads: text("external_downloads", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
  commentsEnabled: integer("comments_enabled", { mode: "boolean" }).notNull().default(false),
  recipesEnabled: integer("recipes_enabled", { mode: "boolean" }).notNull().default(false),
  /** レシピ抽出時に検出したデータパックのネームスペース一覧（slug と一致しないことが多いため保持）。JSON文字列配列 */
  recipeNamespaces: text("recipe_namespaces", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** レシピ画像の見せ方（タグに使うネームスペース・余白のクリップ）。項目が増えても列を足さずに済むようJSONで持つ */
  recipeSettings: text("recipe_settings", { mode: "json" }).$type<RecipeSettings>().notNull().default({}),
  sourceIdeaId: text("source_idea_id"),
  /** 連携する GitHub リポジトリ ("owner/repo" 形式)。Release 自動取り込みに使用 */
  githubRepo: text("github_repo"),
  /** GitHub Release インポート時の取り込みモード (file: ファイル保存, link: 外部リンク) */
  githubReleaseImportMode: text("github_release_import_mode", { enum: ["file", "link"] }).notNull().default("link"),
  /** 新バージョン公開時に告知を送る Discord Webhook URL */
  discordWebhookUrl: text("discord_webhook_url"),
  /** AIによって生成されたコンテンツが含まれるかどうか */
  aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  // author / status / created_at / updated_at による絞り込みと並び替えは posts 側の索引が担う
  index("projects_type_idx").on(table.type),
  index("projects_downloads_idx").on(table.downloads),
]);

// ---- Project Categories ----

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: CONTENT_TYPES }).notNull(),
});

export const projectCategories = sqliteTable(
  "project_categories",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.categoryId] }),
    index("project_categories_project_idx").on(t.projectId),
    index("project_categories_category_idx").on(t.categoryId),
  ]
);

// ---- Project Tags ----

export const projectTags = sqliteTable(
  "project_tags",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.tag] }),
    index("project_tags_project_idx").on(t.projectId),
  ]
);

// ---- Project Members ----

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["collaborator"] }).notNull().default("collaborator"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_members_project_idx").on(t.projectId),
    index("project_members_user_idx").on(t.userId),
  ]
);

// ---- Project Media (スクリーンショット) ----

/**
 * プロジェクトのスクリーンショット画像。
 * featured=true のものだけをプロジェクトページ上部のカルーセルに流す。
 * 動画は無料枠での配信負荷が大きいため対象外（画像のみ）。
 */
export const projectMedia = sqliteTable("project_media", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  /** 表示順。昇順で並べる */
  sortOrder: integer("sort_order").notNull().default(0),
  /** カルーセルに流すか。false のものは画像タブでのみ表示 */
  featured: integer("featured", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("project_media_project_idx").on(table.projectId, table.sortOrder),
]);

/**
 * projects の行。title も author も持たないため、これ単体で Project を表さない。
 * アプリが扱う Project は ProjectPost（Post & ProjectFields）。
 */
export type ProjectFields = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectMedia = typeof projectMedia.$inferSelect;
