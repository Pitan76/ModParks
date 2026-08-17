/**
 * 認証・アカウントまわりのテーブル。
 * users を頂点に、Auth.js が要求する account / session / verificationToken と、
 * 本サービス固有のプロフィール・設定・APIキー・パスキーがぶら下がる。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

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
  /**
   * 最終ログイン日時。信頼ポイントの在籍加点で、休眠アカウントを進めないために使う。
   * 放置されたアカウントが乗っ取られて自動的に高スコアになるのを避ける。
   */
  lastLoginAt:   integer("last_login_at", { mode: "timestamp" }),
  deletedAt:     integer("deleted_at", { mode: "timestamp" }),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }),
  suspendedAt:   integer("suspended_at", { mode: "timestamp" }),
  createdAt:     integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale:        text("locale", { enum: ["ja", "en"] }).notNull().default("ja"),
  defaultProjectStatus: text("default_project_status", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("draft"),
  defaultIdeaStatus: text("default_idea_status", { enum: ["draft", "public", "unlisted", "private"] }).notNull().default("public"),
  defaultProjectBodyFormat: text("default_project_body_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  defaultIdeaBodyFormat: text("default_idea_body_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
  defaultCommentBodyFormat: text("default_comment_body_format", { enum: ["markdown", "plaintext", "pukiwiki"] }).notNull().default("markdown"),
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
  /** CurseForge Upload API 用の個人アカウントトークン（authors-old.curseforge.com/account/api-tokens で発行）。ファイルのアップロード・編集に使う */
  curseforgeUploadApiToken: text("curseforge_upload_api_token"),
  defaultCommentsEnabled: integer("default_comments_enabled", { mode: "boolean" }).notNull().default(false),
  defaultRecipesEnabled: integer("default_recipes_enabled", { mode: "boolean" }).notNull().default(false),
  /** 通知種別ごとの受信ON/OFF。未設定の種別はデフォルトON扱い */
  notificationPrefs: text("notification_prefs", { mode: "json" }).$type<Record<string, boolean>>(),
  /** Discord 通知用の Webhook URL */
  discordWebhookUrl: text("discord_webhook_url"),
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

// ---- Authenticators (WebAuthn / Passkeys) ----

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

/**
 * GitHub App のインストール。
 *
 * 非公開リポジトリの Release 取り込みに使う installation token は、
 * 「そのインストールを行った本人」に紐づいていることを確認してから発行する。
 * この対応表が無いと、App が入っている任意のリポジトリを他人が
 * 自分のプロジェクトに連携させて中身を読めてしまう。
 */
export const githubInstallations = sqliteTable("github_installations", {
  /** GitHub 側の installation_id */
  id: integer("id").primaryKey(),
  /** インストール操作を行った ModParks ユーザー */
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** インストール先のアカウント名（owner）。表示と照合に使う */
  accountLogin: text("account_login").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(), // e.g. "ip:192.168.1.1:login"
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

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

export type User         = typeof users.$inferSelect;
export type UserProfile  = typeof userProfiles.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type ApiKey       = typeof apiKeys.$inferSelect;
