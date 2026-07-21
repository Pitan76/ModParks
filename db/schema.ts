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
  twoFactorSecret: text("two_factor_secret"),
  deletedAt:     integer("deleted_at", { mode: "timestamp" }),
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
  /** 通知種別ごとの受信ON/OFF。未設定の種別はデフォルトON扱い */
  notificationPrefs: text("notification_prefs", { mode: "json" }).$type<Record<string, boolean>>(),
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

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id:          text("id").primaryKey(),
  slug:        text("slug").unique().notNull(),
  previousSlug: text("previous_slug").unique(),
  name:        text("name").notNull(),
  description: text("description").notNull(),
  iconUrl:     text("icon_url"),
  type:        text("type", { enum: ["mod", "plugin", "resourcepack", "datapack", "shader", "modpack"] }).notNull(),
  license:     text("license").notNull(),
  sourceUrl:   text("source_url"),
  links:       text("links"),
  status:      text("status", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("draft"),
  descriptionFormat: text("description_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  downloads:   integer("downloads").notNull().default(0),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
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
  authorIdx: index("projects_author_idx").on(table.authorId),
  statusIdx: index("projects_status_idx").on(table.status),
  typeIdx: index("projects_type_idx").on(table.type),
  downloadsIdx: index("projects_downloads_idx").on(table.downloads),
  updatedAtIdx: index("projects_updated_at_idx").on(table.updatedAt),
  createdAtIdx: index("projects_created_at_idx").on(table.createdAt),
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

export const projectFavorites = sqliteTable(
  "project_favorites",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
    projectIdx: index("project_favorites_project_idx").on(t.projectId),
    userIdx: index("project_favorites_user_idx").on(t.userId),
  })
);

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

// ─── Ideas ────────────────────────────────────────────────────────────────────

export const ideas = sqliteTable("ideas", {
  id:          text("id").primaryKey(),
  title:       text("title").notNull(),
  content:     text("content").notNull(),
  contentFormat: text("content_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status:      text("status", { enum: ["open", "in_progress", "fulfilled"] }).notNull().default("open"),
  visibility:  text("visibility", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("draft"),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  authorIdx: index("ideas_author_idx").on(table.authorId),
  statusIdx: index("ideas_status_idx").on(table.status),
}));

export const ideaLikes = sqliteTable(
  "idea_likes",
  {
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({ 
    pk: primaryKey({ columns: [t.ideaId, t.userId] }),
    ideaIdx: index("idea_likes_idea_idx").on(t.ideaId),
    userIdx: index("idea_likes_user_idx").on(t.userId),
  })
);

export const ideaComments = sqliteTable("idea_comments", {
  id:          text("id").primaryKey(),
  ideaId:      text("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 返信先の親コメントID（1階層のみ）。トップレベルなら null */
  parentId:    text("parent_id"),
  content:     text("content").notNull(),
  contentFormat: text("content_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  ideaIdx: index("idea_comments_idea_idx").on(table.ideaId),
  authorIdx: index("idea_comments_author_idx").on(table.authorId),
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
export type Project     = typeof projects.$inferSelect;
export type Version     = typeof versions.$inferSelect;
export type Report      = typeof reports.$inferSelect;
export type Idea        = typeof ideas.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
export type ApiKey      = typeof apiKeys.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectDependency = typeof projectDependencies.$inferSelect;
export type Tag         = typeof tags.$inferSelect;
export type Platform    = typeof platforms.$inferSelect;

export type UserFollow  = typeof userFollows.$inferSelect;
export type CollectionFollow = typeof collectionFollows.$inferSelect;
export type ProjectComment = typeof projectComments.$inferSelect;

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

// ─── Project Comments ─────────────────────────────────────────────────────────

export const projectComments = sqliteTable("project_comments", {
  id:          text("id").primaryKey(),
  projectId:   text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 返信先の親コメントID（1階層のみ）。トップレベルなら null */
  parentId:    text("parent_id"),
  content:     text("content").notNull(),
  contentFormat: text("content_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  projectIdx: index("project_comments_project_idx").on(table.projectId),
  authorIdx: index("project_comments_author_idx").on(table.authorId),
}));

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
  type: text("type", {
    enum: [
      "new_version", "new_project", "project_comment", "idea_comment",
      "idea_like", "project_favorite", "follow", "list_add", "comment_reply",
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
