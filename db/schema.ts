import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// クリエイタ還元のテーブル群。schema.ts の肥大化を避けて別ファイルに置く
export * from "./schema-reward";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id:            text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  
  // Auth.js standard fields
  name:          text("name"),
  email:         text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image:         text("image"),
  
  // Core & Security fields
  passwordHash:  text("password_hash"),
  githubId:      text("github_id").unique(),
  role:          text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  /**
   * プレミアム区分。現状は販売しておらず、管理画面からの手動付与のみ。
   * 課金導入時はここに決済由来の更新を流し込む。
   */
  premiumTier:   text("premium_tier", { enum: ["free", "premium"] }).notNull().default("free"),
  /** プレミアムの有効期限。null は無期限（買い切り／手動付与の既定） */
  premiumUntil:  integer("premium_until", { mode: "timestamp" }),
  twoFactorSecret: text("two_factor_secret"),
  deletedAt:     integer("deleted_at", { mode: "timestamp" }),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }),
  suspendedAt:   integer("suspended_at", { mode: "timestamp" }),
  createdAt:     integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── User Profiles ─────────────────────────────────────────────────────────────

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  username:      text("username").unique().notNull(),
  displayName:   text("display_name"),
  avatarUrl:     text("avatar_url"),
  bio:           text("bio"),
  links:         text("links"),
  previousUsername: text("previous_username"),
  githubUsername: text("github_username"),
});

// ─── User Settings ─────────────────────────────────────────────────────────────

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale:        text("locale", { enum: ["ja", "en"] }).notNull().default("ja"),
  defaultProjectStatus: text("default_project_status", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("draft"),
  defaultIdeaStatus: text("default_idea_status", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("public"),
  defaultLicense: text("default_license").notNull().default("All Rights Reserved"),
  custom:        text("custom", { mode: "json" }),
  modrinthApiKey: text("modrinth_api_key"),
  /** @deprecated Studios コンソールキーは運営が env CURSEFORGE_FOR_STUDIOS_API_KEY で全体設定する方式に移行 */
  curseforgeApiKey: text("curseforge_api_key"),
  /** 所有確認済みの CurseForge 作者ID。この作者のプロジェクトのみインポートを許可する */
  curseforgeAuthorId: text("curseforge_author_id"),
  curseforgeProjectId: text("curseforge_project_id"),
  /** @deprecated アップロードAPIでは安全に所有確認できないため、チャレンジコード方式へ移行 */
  curseforgeAuthorToken: text("curseforge_author_token"),
  /** 発行中の所有確認コード。プロジェクトの公開フィールドに記載されているか照合する */
  curseforgeVerifyCode: text("curseforge_verify_code"),
  /** 所有確認が完了した日時。未確認なら null */
  curseforgeVerifiedAt: integer("curseforge_verified_at", { mode: "timestamp" }),
  defaultCommentsEnabled: integer("default_comments_enabled", { mode: "boolean" }).notNull().default(false),
  defaultRecipesEnabled: integer("default_recipes_enabled", { mode: "boolean" }).notNull().default(false),
  /** 通知種別ごとの受信ON/OFF。未設定の種別はデフォルトON扱い */
  notificationPrefs: text("notification_prefs", { mode: "json" }).$type<Record<string, boolean>>(),
  /** クリエイタ還元に参加するか。false のユーザーは配分対象から除外する */
  creatorRewardOptIn: integer("creator_reward_opt_in", { mode: "boolean" }).notNull().default(false),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").unique().notNull(),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
}, (table) => ({
  userIdx: index("api_keys_user_idx").on(table.userId),
}));

// ─── Posts (Project / Idea の共通基底) ────────────────────────────────────────

/**
 * ユーザーが作成する投稿の共通部分。Project と Idea はこのテーブルを継承する
 * （Class Table Inheritance）。`projects.id` / `ideas.id` が `posts.id` を参照し、
 * 1 つの投稿は「posts の 1 行 + 子テーブルの 1 行」で構成される。
 *
 * 詳細な設計意図は docs-md/DESIGN.md を参照。
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

// ─── Post Comments (Project / Idea 共通) ──────────────────────────────────────

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

// ─── Post Favorites (Project / Idea 共通) ─────────────────────────────────────

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

// ─── Projects ─────────────────────────────────────────────────────────────────

/**
 * Project 固有の情報。共通部分（title / body / slug / visibility / author / 日時）は
 * posts が持つ。単体では投稿として成立しないため、必ず posts と JOIN して使う。
 */
export const projects = sqliteTable("projects", {
  id:          text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  iconUrl:     text("icon_url"),
  type:        text("type", { enum: ["mod", "plugin", "resourcepack", "datapack", "shader", "modpack"] }).notNull(),
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
}, (table) => ({
  // author / status / created_at / updated_at による絞り込みと並び替えは posts 側の索引が担う
  typeIdx: index("projects_type_idx").on(table.type),
  downloadsIdx: index("projects_downloads_idx").on(table.downloads),
}));

// ─── Project Categories ───────────────────────────────────────────────────────

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["mod", "plugin", "resourcepack", "datapack", "shader", "modpack"] }).notNull(),
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
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.categoryId] }),
    projectIdx: index("project_categories_project_idx").on(t.projectId),
    categoryIdx: index("project_categories_category_idx").on(t.categoryId),
  })
);

// ─── Versions ─────────────────────────────────────────────────────────────────

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
}, (table) => ({
  projectIdx: index("versions_project_idx").on(table.projectId),
  projectCreatedAtIdx: index("versions_project_created_at_idx").on(table.projectId, table.createdAt),
}));

// ─── Version Search Optimizations ──────────────────────────────────────────────

export const versionLoaders = sqliteTable(
  "version_loaders",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    loader: text("loader").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.loader] }),
    versionIdx: index("version_loaders_version_idx").on(t.versionId),
    loaderIdx: index("version_loaders_loader_idx").on(t.loader),
  })
);

export const versionMcVersions = sqliteTable(
  "version_mc_versions",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    mcVersion: text("mc_version").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.mcVersion] }),
    versionIdx: index("version_mc_versions_version_idx").on(t.versionId),
    mcVersionIdx: index("version_mc_versions_mc_version_idx").on(t.mcVersion),
  })
);

// ─── Project Tags ─────────────────────────────────────────────────────────────

export const projectTags = sqliteTable(
  "project_tags",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => ({ 
    pk: primaryKey({ columns: [t.projectId, t.tag] }),
    projectIdx: index("project_tags_project_idx").on(t.projectId),
  })
);

// ─── Project Dependencies ───────────────────────────────────────────────────────

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
  (t) => ({
    projectIdx: index("project_deps_project_idx").on(t.projectId),
    targetIdx: index("project_deps_target_idx").on(t.targetProjectId),
  })
);

// ─── Project Members ─────────────────────────────────────────────────────────

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
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
    projectIdx: index("project_members_project_idx").on(t.projectId),
    userIdx: index("project_members_user_idx").on(t.userId),
  })
);

// ─── Project Favorites ────────────────────────────────────────────────────────

// ─── Project Media (スクリーンショット) ────────────────────────────────────────

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
}, (table) => ({
  projectIdx: index("project_media_project_idx").on(table.projectId, table.sortOrder),
}));

export type ProjectMedia = typeof projectMedia.$inferSelect;

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
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.recipeId] }),
    projectIdx: index("project_hidden_recipes_project_idx").on(t.projectId),
  })
);

export type ProjectHiddenRecipe = typeof projectHiddenRecipes.$inferSelect;

// ─── Collections (Lists) ─────────────────────────────────────────────────────────

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(), // cuid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    visibility: text("visibility").notNull().default("public"), // public | unlisted | private
    iconUrl: text("icon_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    userIdx: index("collections_user_idx").on(t.userId),
  })
);

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.projectId] }),
    collectionIdx: index("collection_items_collection_idx").on(t.collectionId),
    projectIdx: index("collection_items_project_idx").on(t.projectId),
  })
);

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reports = sqliteTable("reports", {
  id:         text("id").primaryKey(),
  reason:     text("reason", {
    enum: ["copyright", "malware", "spam", "other"],
  }).notNull(),
  detail:     text("detail"),
  status:     text("status", {
    enum: ["pending", "resolved", "dismissed"],
  }).notNull().default("pending"),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId:  text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt:  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  reporterIdx: index("reports_reporter_idx").on(table.reporterId),
  projectIdx:  index("reports_project_idx").on(table.projectId),
}));

// ─── Scan Appeals ─────────────────────────────────────────────────────────────

/**
 * jar スキャンの判定に対する作者からの異議申請。
 * ヒューリスティック検査は誤検知するため、人の目で覆せる経路を必ず用意する。
 */
export const scanAppeals = sqliteTable("scan_appeals", {
  id:        text("id").primaryKey(),
  reason:    text("reason").notNull(),
  status:    text("status", {
    enum: ["pending", "approved", "rejected"],
  }).notNull().default("pending"),
  /** 管理者が却下・承認時に残すコメント。作者に開示する */
  reviewNote: text("review_note"),
  versionId: text("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  appellantId: text("appellant_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewedById: text("reviewed_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  versionIdx:   index("scan_appeals_version_idx").on(table.versionId),
  statusIdx:    index("scan_appeals_status_idx").on(table.status),
  appellantIdx: index("scan_appeals_appellant_idx").on(table.appellantId),
}));

// ─── Ideas ────────────────────────────────────────────────────────────────────

/**
 * Idea 固有の情報。共通部分は posts が持つ。
 * 現状 status のみだが、Idea 固有の項目を足す場所として独立させておく。
 */
export const ideas = sqliteTable("ideas", {
  id:          text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  status:      text("status", { enum: ["open", "in_progress", "fulfilled"] }).notNull().default("open"),
}, (table) => ({
  statusIdx: index("ideas_status_idx").on(table.status),
}));

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

// ─── Profile Pins (プロフィールのピン留め) ────────────────────────────────────

/**
 * プロフィール上部にピン留めするアイテム。プロジェクトまたはアイデアを指す。
 * 1 ユーザーあたり最大 6 件（上限はアプリ側の Server Action で担保する）。
 *
 * itemId はプロジェクト/アイデアどちらも指しうる多相参照のため外部キーは張らない。
 * 対象が削除された場合はピンが宙に浮くが、表示クエリの内部結合で自然に除外される。
 */
export const profilePins = sqliteTable(
  "profile_pins",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ピン留め対象の種別 */
    itemType: text("item_type", { enum: ["project", "idea"] }).notNull(),
    /** projects.id または ideas.id */
    itemId: text("item_id").notNull(),
    /** 表示順。昇順で並べる */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.itemType, t.itemId] }),
    userIdx: index("profile_pins_user_idx").on(t.userId),
  })
);

export type ProfilePin = typeof profilePins.$inferSelect;

// ─── Tags & Platforms ────────────────────────────────────────────────────────

export const tags = sqliteTable("tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const platforms = sqliteTable("platforms", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  iconUrl: text("icon_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User        = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
/**
 * posts の行。単体の Post は投稿として完結しており、共通処理はこの型で書ける。
 * Project / Idea として扱うときは types/post.ts の ProjectPost / IdeaPost を使う。
 */
export type Post        = typeof posts.$inferSelect;
/**
 * projects の行。title も author も持たないため、これ単体で Project を表さない。
 * アプリが扱う Project は ProjectPost（Post & ProjectFields）。
 */
export type ProjectFields = typeof projects.$inferSelect;
/** ideas の行。ProjectFields と同じ理由で、単体で Idea を表さない */
export type IdeaFields  = typeof ideas.$inferSelect;
export type Comment     = typeof comments.$inferSelect;
export type Favorite    = typeof favorites.$inferSelect;
export type Version     = typeof versions.$inferSelect;
export type Report      = typeof reports.$inferSelect;
export type ApiKey      = typeof apiKeys.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectDependency = typeof projectDependencies.$inferSelect;
export type Tag         = typeof tags.$inferSelect;
export type Platform    = typeof platforms.$inferSelect;

export type UserFollow  = typeof userFollows.$inferSelect;
export type CollectionFollow = typeof collectionFollows.$inferSelect;

// ─── Authenticators (WebAuthn / Passkeys) ───────────────────────────────────

export const authenticators = sqliteTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: integer("credentialBackedUp", {
      mode: "boolean",
    }).notNull(),
    transports: text("transports"),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (authenticator) => ({
    compositePK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  })
);

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(), // e.g. "ip:192.168.1.1:login"
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// ─── User Follows ─────────────────────────────────────────────────────────────

export const userFollows = sqliteTable(
  "user_follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.followingId] }),
    followerIdx: index("user_follows_follower_idx").on(t.followerId),
    followingIdx: index("user_follows_following_idx").on(t.followingId),
  })
);

// ─── Collection Follows ───────────────────────────────────────────────────────

export const collectionFollows = sqliteTable(
  "collection_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.collectionId] }),
    userIdx: index("collection_follows_user_idx").on(t.userId),
    collectionIdx: index("collection_follows_collection_idx").on(t.collectionId),
  })
);

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  tokenIdx: index("password_reset_tokens_token_idx").on(table.token),
  userIdx: index("password_reset_tokens_user_idx").on(table.userId),
}));

// ─── Project Subscriptions (通知ベル) ─────────────────────────────────────────

export const projectSubscriptions = sqliteTable(
  "project_subscriptions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.projectId] }),
    projectIdx: index("project_subscriptions_project_idx").on(t.projectId),
    userIdx: index("project_subscriptions_user_idx").on(t.userId),
  })
);

export type ProjectSubscription = typeof projectSubscriptions.$inferSelect;

// ─── Developer Subscriptions (プロフィールの通知ベル) ─────────────────────────

export const developerSubscriptions = sqliteTable(
  "developer_subscriptions",
  {
    subscriberId: text("subscriber_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 通知を購読する対象の開発者 */
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.subscriberId, t.developerId] }),
    developerIdx: index("developer_subscriptions_developer_idx").on(t.developerId),
    subscriberIdx: index("developer_subscriptions_subscriber_idx").on(t.subscriberId),
  })
);

export type DeveloperSubscription = typeof developerSubscriptions.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** 通知の受信者 */
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * 通知の種別。Post 統合に伴い、Project / Idea で分かれていた種別を統合した。
   *   project_comment + idea_comment → comment
   *   idea_like + project_favorite   → favorite
   * 対象が Project か Idea かは payload.kind で判別する。
   */
  type: text("type", {
    enum: [
      "new_version", "new_project", "comment", "favorite",
      "follow", "list_add", "comment_reply",
    ],
  }).notNull(),
  /** 表示に必要な情報 (projectSlug, projectName, versionNumber 等)。type ごとに構造が異なる */
  payload: text("payload", { mode: "json" }).$type<Record<string, string>>().notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  userIdx: index("notifications_user_idx").on(table.userId),
  userReadIdx: index("notifications_user_read_idx").on(table.userId, table.read),
}));

export type Notification = typeof notifications.$inferSelect;

// ─── Push Subscriptions (Web Push / PWA プッシュ通知) ─────────────────────────

/**
 * ブラウザ/PWA の PushManager 購読情報。1 ユーザーが複数端末（endpoint）を持ちうる。
 * endpoint がプッシュの宛先で、p256dh/auth は本文暗号化（aes128gcm）に使う公開鍵。
 * 送信時に 404/410 が返った購読は失効しているため削除する。
 */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** プッシュサービスの宛先 URL。端末ごとに一意 */
  endpoint: text("endpoint").notNull().unique(),
  /** 本文暗号化用のクライアント公開鍵（base64url） */
  p256dh: text("p256dh").notNull(),
  /** 本文暗号化用の認証シークレット（base64url） */
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  userIdx: index("push_subscriptions_user_idx").on(table.userId),
}));

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

// ─── Settings Audit ───────────────────────────────────────────────────────────

/**
 * アプリ設定 (KV) と Worker vars (GitHub PR) の変更履歴。
 * 値の実体は KV / wrangler.toml 側にあり、このテーブルは「誰がいつ何を変えたか」だけを保持する。
 */
export const settingsAudit = sqliteTable("settings_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /**
   * 変更対象の種別:
   * app = KV のアプリ設定 / vars = wrangler.toml の [vars] / secret = Worker のシークレット
   */
  scope: text("scope", { enum: ["app", "vars", "secret"] }).notNull(),
  /** 変更されたキー */
  key: text("key").notNull(),
  /**
   * 変更前後の値（JSON 文字列化した表現）。
   * scope = "secret" の場合は値そのものを記録せず、常に null にする。
   */
  oldValue: text("old_value"),
  newValue: text("new_value"),
  /** vars の場合、作成した Pull Request の URL */
  prUrl: text("pr_url"),
  /**
   * 変更者の users.id。
   * 外部キーは意図的に張っていません。users を参照すると、復元処理の
   * users 全削除に連動してこの監査ログ自体がカスケード削除されるためです。
   * 代わりに変更時点のメールアドレスを非正規化して保持します。
   */
  changedBy: text("changed_by").notNull(),
  changedByEmail: text("changed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  scopeIdx: index("settings_audit_scope_idx").on(table.scope, table.createdAt),
}));

export type SettingsAudit = typeof settingsAudit.$inferSelect;

// ─── Backup Audit ─────────────────────────────────────────────────────────────

/**
 * バックアップ・復元操作の監査ログ。
 *
 * 復元は全テーブルを削除して入れ替えるため、このテーブルは意図的に
 * バックアップ／復元の対象（adminBackup.ts の SCHEMA_TABLES）に含めていません。
 * 復元をまたいでログが残ることで「いつ誰がどのデータに戻したか」を追跡できます。
 *
 * 同じ理由で performedBy には外部キー制約を張っていません。
 * users を参照すると、復元時の users 全削除に連動してログ自体が消えてしまいます。
 * 代わりに操作時点のメールアドレスを非正規化して保持します。
 */
export const backupAudit = sqliteTable("backup_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  action: text("action", {
    enum: ["create", "auto_create", "restore", "merge", "delete", "snapshot", "drive_upload"],
  }).notNull(),
  /** 操作対象のバックアップの R2 キー（削除・復元の対象） */
  backupKey: text("backup_key"),
  /** 復元時に取得した切り戻し用スナップショットの R2 キー */
  snapshotKey: text("snapshot_key"),
  status: text("status", { enum: ["success", "failure"] }).notNull(),
  /** 失敗時のエラーメッセージ、成功時はテーブルごとの件数などの詳細 */
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  /** 操作者の users.id。cron による自動実行の場合は null */
  performedBy: text("performed_by"),
  /** 操作時点の操作者のメールアドレス。users が入れ替わってもログを読めるようにするため */
  performedByEmail: text("performed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  actionIdx: index("backup_audit_action_idx").on(table.action, table.createdAt),
}));

export type BackupAudit = typeof backupAudit.$inferSelect;

// ─── Moderation Audit ─────────────────────────────────────────────────────────

/**
 * 管理者によるモデレーション操作（通報対応・非公開化・権限変更・スキャン異議裁定など）の監査ログ。
 *
 * settingsAudit / backupAudit と同じ理由で users への外部キーは張らず、
 * 操作時点のメールアドレスを非正規化して保持する。
 */
export const moderationAudit = sqliteTable("moderation_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  action: text("action", {
    enum: [
      "report_resolve",
      "report_dismiss",
      // Post 統合により Project / Idea のどちらも非公開にできるため改名
      "post_unpublish",
      "role_change",
      "scan_appeal_approve",
      "scan_appeal_reject",
      "suspend_user",
      "unsuspend_user",
      "premium_grant",
      "premium_revoke",
    ],
  }).notNull(),
  /** 操作対象の識別子（projectId / userId / versionId など） */
  targetId: text("target_id").notNull(),
  /** 追加情報（変更前後の値・理由など）を JSON で保持する */
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  performedBy: text("performed_by").notNull(),
  performedByEmail: text("performed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  actionIdx: index("moderation_audit_action_idx").on(table.action, table.createdAt),
}));

export type ModerationAudit = typeof moderationAudit.$inferSelect;

// ─── Deleted Records (墓標) ───────────────────────────────────────────────────

/**
 * 削除された行の墓標。
 *
 * マージ復元で「バックアップ後に削除された行」が復活するのを防ぐために使います。
 * 行そのものは従来通り物理削除するため、通常の読み取りクエリには影響しません
 * （論理削除にすると全ての SELECT に isNull(deletedAt) が必要になる）。
 *
 * backup_audit と同じ理由で、バックアップ・復元の対象外かつ外部キーなしです。
 * 復元をまたいで残らなければ、削除の記録としての意味がありません。
 */
export const deletedRecords = sqliteTable("deleted_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** 削除された行のテーブル名。adminBackup の SCHEMA_TABLES のキーと同じ表記を使う */
  tableName: text("table_name").notNull(),
  /**
   * 削除された行の主キー。
   * 複合主キーの場合は列を ":" で連結した文字列にする（例 "projectId:userId"）。
   */
  recordKey: text("record_key").notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  // マージ時に (テーブル, 主キー) で存在確認するための索引
  lookupIdx: uniqueIndex("deleted_records_lookup_idx").on(table.tableName, table.recordKey),
}));

export type DeletedRecord = typeof deletedRecords.$inferSelect;

// ─── DDoS Defense (自動DDoS防御システム) ──────────────────────────────────────

export const ddosSlices = sqliteTable("ddos_slices", {
  sliceTime:          integer("slice_time").notNull(),       // 10秒単位のEpoch秒
  isolateId:          text("isolate_id").notNull(),          // Worker IsolateのランダムID
  requestCount:       integer("request_count").notNull(),    // 期間内の総アクセス数
  downloadCount:      integer("download_count").notNull(),   // /api/download アクセス数
  uniqueIpCount:      integer("unique_ip_count").notNull(),  // Isolate内ユニークIP数 (上限1000)
  uniqueCountryCount: integer("unique_country_count").notNull(), // Isolate内ユニーク国数
  topSlug:            text("top_slug"),                       // 最多アクセスのslug
  topSlugCount:       integer("top_slug_count"),              // そのslugへのアクセス数
}, (t) => [
  primaryKey({ columns: [t.sliceTime, t.isolateId] })
]);

export type DdosSlice = typeof ddosSlices.$inferSelect;

export const ddosState = sqliteTable("ddos_state", {
  stateKey:             text("state_key").primaryKey(),       // 値は常に 'global'
  currentState:         text("current_state").notNull(),      // ステータス名
  attackDetectedAt:     integer("attack_detected_at").notNull(),
  underAttackEnabledAt: integer("under_attack_enabled_at").notNull(),
  scheduledDisableAt:   integer("scheduled_disable_at").notNull(),
  cooldownUntil:        integer("cooldown_until").notNull(),
  updatedAt:            integer("updated_at").notNull(),
  protectionDuration:   integer("protection_duration").notNull(), // 防護適用時間 (ms)
  lastNormalAt:         integer("last_normal_at").notNull(),  // 最終 NORMAL 遷移時刻 (ms)
});

export type DdosStateModel = typeof ddosState.$inferSelect;

/**
 * DDoS 防護の状態遷移の監査ログ。
 *
 * ddos_state は「今どうなっているか」しか持たず、Discord 通知も流れて消えるため、
 * 「いつ・何をきっかけに防護が入り、いつ外れたか」を後から追える記録をここに残す。
 *
 * 他の監査ログと同様、users への外部キーは張らず操作時点のメールを非正規化して保持する。
 * 自動検知や Cron による遷移では performed_by は null（システム実行）になる。
 */
export const ddosAudit = sqliteTable("ddos_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  action: text("action", {
    enum: [
      /** 自動検知による WAF 有効化（UNDER_ATTACK 突入） */
      "auto_activate",
      /** 攻撃検知したが Cloudflare API に失敗し COOLDOWN へ退避 */
      "auto_activate_failed",
      /** 防護期限切れによる Cron の自動解除 */
      "auto_deactivate",
      /** 自動解除の Cloudflare API 失敗（UNDER_ATTACK へ差し戻し） */
      "auto_deactivate_failed",
      /** 管理者による手動の防護有効化 */
      "manual_activate",
      /** 管理者による手動の防護解除 */
      "manual_deactivate",
      /** ACTIVATING / DEACTIVATING でスタックした状態の Cron による復旧 */
      "recover",
    ],
  }).notNull(),
  /** 遷移後の ddos_state.current_state */
  state: text("state").notNull(),
  /** 検知メトリクス・対象 slug・防護時間・エラー内容などを JSON で保持する */
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  /** 操作者の users.id。自動検知・Cron による遷移では null */
  performedBy: text("performed_by"),
  performedByEmail: text("performed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  actionIdx: index("ddos_audit_action_idx").on(table.action, table.createdAt),
}));

export type DdosAudit = typeof ddosAudit.$inferSelect;

