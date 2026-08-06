/**
 * ユーザー同士・ユーザーとコンテンツのつながりを表すテーブル群。
 * コレクション、フォロー、購読、ピン留め、通知が含まれる。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects } from "./projects";

// ---- Collections (Lists) ----

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

// ---- Follows ----

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

// ---- Subscriptions (通知ベル) ----

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

// ---- Profile Pins (プロフィールのピン留め) ----

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

// ---- Notifications ----

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

export type UserFollow             = typeof userFollows.$inferSelect;
export type CollectionFollow       = typeof collectionFollows.$inferSelect;
export type ProjectSubscription    = typeof projectSubscriptions.$inferSelect;
export type DeveloperSubscription  = typeof developerSubscriptions.$inferSelect;
export type ProfilePin             = typeof profilePins.$inferSelect;
export type Notification           = typeof notifications.$inferSelect;
export type PushSubscriptionRow    = typeof pushSubscriptions.$inferSelect;
