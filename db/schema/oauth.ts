/**
 * ModParks を OAuth 2.0 認可サーバーとして動かすためのテーブル。
 *
 * 外部プラットフォームは oauth_clients に登録し、Authorization Code + PKCE で
 * ユーザーの同意を得てアクセストークンを受け取る。トークン・認可コード・
 * クライアントシークレットはいずれも SHA-256 のハッシュのみを保存し、平文は発行時にしか出さない。
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const oauthClients = sqliteTable("oauth_clients", {
  /** client_id。外部に露出するため推測しにくい値を入れる */
  id: text("id").primaryKey(),
  /** confidential クライアントのみ。public クライアント（PKCE のみ）は null */
  secretHash: text("secret_hash"),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  homepageUrl: text("homepage_url"),
  /** 登録したユーザー。アプリの管理権限はこの1人が持つ */
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 許可するリダイレクト先の完全一致リスト（JSON 配列） */
  redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
  /** このクライアントが要求できるスコープ（スペース区切り） */
  scopes: text("scopes").notNull(),
  /** false なら public クライアント扱いで PKCE を必須にする */
  isConfidential: integer("is_confidential", { mode: "boolean" }).notNull().default(true),
  /** 運営が承認した公式連携。同意画面に警告を出さない */
  isTrusted: integer("is_trusted", { mode: "boolean" }).notNull().default(false),
  disabledAt: integer("disabled_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("oauth_clients_owner_idx").on(table.ownerUserId),
]);

/**
 * 認可コード。単発利用・短命で、使用済みは usedAt を立てて再利用を弾く。
 * 削除ではなく使用済みマークにするのは、同じコードの二重投入を検知して
 * 発行済みトークンごと失効させる（RFC 6749 4.1.2）ため。
 */
export const oauthAuthCodes = sqliteTable("oauth_auth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  scope: text("scope").notNull(),
  /** OIDC の nonce。id_token にそのまま載せてリプレイを防ぐ */
  nonce: text("nonce"),
  codeChallenge: text("code_challenge"),
  codeChallengeMethod: text("code_challenge_method", { enum: ["S256"] }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
}, (table) => [
  index("oauth_auth_codes_expires_idx").on(table.expiresAt),
]);

export const oauthAccessTokens = sqliteTable("oauth_access_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tokenHash: text("token_hash").unique().notNull(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("oauth_access_tokens_user_client_idx").on(table.userId, table.clientId),
]);

export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tokenHash: text("token_hash").unique().notNull(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  /** ローテーション時に発行した後継トークン。再利用検知に使う */
  replacedBy: text("replaced_by"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("oauth_refresh_tokens_user_client_idx").on(table.userId, table.clientId),
]);

/**
 * ユーザーがクライアントに与えた同意。
 * 同じスコープを再要求されたときに同意画面を省略する判断と、
 * 設定画面の「連携中のアプリ」一覧の両方に使う。
 */
export const oauthGrants = sqliteTable("oauth_grants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("oauth_grants_user_client_uniq").on(table.userId, table.clientId),
]);

export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthGrant = typeof oauthGrants.$inferSelect;
export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect;
