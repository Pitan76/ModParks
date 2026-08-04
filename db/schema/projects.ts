/**
 * Project 固有のテーブル群。プロジェクト本体と、そこにぶら下がる
 * カテゴリ・バージョン・タグ・依存・メンバー・メディアを持つ。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { posts } from "./posts";
import { CONTENT_TYPES } from "../../lib/data/projectTypes";

/**
 * Project 固有の情報。共通部分（title / body / slug / visibility / author / 日時）は
 * posts が持つ。単体では投稿として成立しないため、必ず posts と JOIN して使う。
 */
export const projects = sqliteTable("projects", {
  id:          text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  iconUrl:     text("icon_url"),
  type:        text("type", { enum: CONTENT_TYPES }).notNull(),
  license:     text("license").notNull(),
  sourceUrl:   text("source_url"),
  links:       text("links"),
  downloads:   integer("downloads").notNull().default(0),
  modrinthId:  text("modrinth_id"),
  curseforgeId: text("curseforge_id"),
  issueTrackerUrl: text("issue_tracker_url"),
  totalDownloads: integer("total_downloads").notNull().default(0),
  externalDownloads: text("external_downloads", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
  commentsEnabled: integer("comments_enabled", { mode: "boolean" }).notNull().default(false),
  recipesEnabled: integer("recipes_enabled", { mode: "boolean" }).notNull().default(false),
  /** レシピ抽出時に検出したデータパックのネームスペース一覧（slug と一致しないことが多いため保持）。JSON文字列配列 */
  recipeNamespaces: text("recipe_namespaces", { mode: "json" }).$type<string[]>().notNull().default([]),
  sourceIdeaId: text("source_idea_id"),
  /** 連携する GitHub リポジトリ ("owner/repo" 形式)。Release 自動取り込みに使用 */
  githubRepo: text("github_repo"),
  /** 新バージョン公開時に告知を送る Discord Webhook URL */
  discordWebhookUrl: text("discord_webhook_url"),
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

// ---- Versions ----

export const versions = sqliteTable("versions", {
  id:            text("id").primaryKey(),
  versionNumber: text("version_number").notNull(),
  /** JSON: string[] — 対応 MC バージョン */
  mcVersions:    text("mc_versions").notNull(),
  /** JSON: string[] — 対応ローダー */
  loaders:       text("loaders").notNull(),
  changelog:     text("changelog").notNull(),
  /** リリースチャネル: release(安定版) / beta / alpha */
  releaseChannel: text("release_channel").notNull().default("release"),
  fileUrl:       text("file_url").notNull(),
  fileName:      text("file_name").notNull(),
  fileSize:      integer("file_size"),
  fileSha256:    text("file_sha256"),
  downloads:     integer("downloads").notNull().default(0),
  /** jar ヒューリスティック検査の判定: pending / clean / suspicious / malicious / skipped */
  scanStatus:    text("scan_status").notNull().default("pending"),
  /** JSON: ScanFinding[] — 検出内容。作者・管理者にのみ開示する */
  scanFindings:  text("scan_findings"),
  scanAt:        integer("scan_at", { mode: "timestamp" }),
  /** アーカイブ日時。null でなければアーカイブ済み（公開一覧・DLから除外、作者のみ閲覧可） */
  archivedAt:    integer("archived_at", { mode: "timestamp" }),
  projectId:     text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt:     integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("versions_project_idx").on(table.projectId),
  index("versions_project_created_at_idx").on(table.projectId, table.createdAt),
]);

// ---- Version Search Optimizations ----

export const versionLoaders = sqliteTable(
  "version_loaders",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    loader: text("loader").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.versionId, t.loader] }),
    index("version_loaders_version_idx").on(t.versionId),
    index("version_loaders_loader_idx").on(t.loader),
  ]
);

export const versionMcVersions = sqliteTable(
  "version_mc_versions",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    mcVersion: text("mc_version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.versionId, t.mcVersion] }),
    index("version_mc_versions_version_idx").on(t.versionId),
    index("version_mc_versions_mc_version_idx").on(t.mcVersion),
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

// ---- Project Dependencies ----

export const projectDependencies = sqliteTable(
  "project_dependencies",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    targetProjectId: text("target_project_id").references(() => projects.id, { onDelete: "cascade" }),
    externalUrl: text("external_url"),
    externalName: text("external_name"),
    dependencyType: text("dependency_type").notNull().default("required"), // required, optional, incompatible, embedded
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index("project_deps_project_idx").on(t.projectId),
    index("project_deps_target_idx").on(t.targetProjectId),
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
  id:        text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url:       text("url").notNull(),
  caption:   text("caption"),
  /** 表示順。昇順で並べる */
  sortOrder: integer("sort_order").notNull().default(0),
  /** カルーセルに流すか。false のものは画像タブでのみ表示 */
  featured:  integer("featured", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("project_media_project_idx").on(table.projectId, table.sortOrder),
]);

/**
 * プロジェクトページで非表示にするレシピ。
 *
 * レシピの実体は jar 由来でレシピCDN（mp-recipe）が持つため、ここでは「出さない」判断だけを持つ。
 * 中間生成物や見せたくないレシピが jar に含まれていても、再抽出のたびに復活しないようにするための表。
 */
export const projectHiddenRecipes = sqliteTable(
  "project_hidden_recipes",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** 完全修飾レシピID（例 "mymod:widget"）。CDN の索引が返す id と同じ表記 */
    recipeId: text("recipe_id").notNull(),
    hiddenBy: text("hidden_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.recipeId] }),
    index("project_hidden_recipes_project_idx").on(t.projectId),
  ]
);

/**
 * projects の行。title も author も持たないため、これ単体で Project を表さない。
 * アプリが扱う Project は ProjectPost（Post & ProjectFields）。
 */
export type ProjectFields        = typeof projects.$inferSelect;
export type Version              = typeof versions.$inferSelect;
export type ProjectMember        = typeof projectMembers.$inferSelect;
export type ProjectDependency    = typeof projectDependencies.$inferSelect;
export type ProjectMedia         = typeof projectMedia.$inferSelect;
export type ProjectHiddenRecipe  = typeof projectHiddenRecipes.$inferSelect;
