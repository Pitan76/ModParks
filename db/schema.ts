import {
  sqliteTable,
  text,
  integer,
  primaryKey,
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
  
  // Custom ModParks fields
  passwordHash:  text("password_hash"),
  githubId:      text("github_id").unique(),
  username:      text("username").unique(),
  displayName:   text("display_name"),
  avatarUrl:     text("avatar_url"),
  bio:           text("bio"),
  role:          text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt:     integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
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

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id:          text("id").primaryKey(),
  slug:        text("slug").unique().notNull(),
  name:        text("name").notNull(),
  description: text("description").notNull(),
  iconUrl:     text("icon_url"),
  type:        text("type", { enum: ["mod", "plugin"] }).notNull(),
  license:     text("license").notNull(),
  sourceUrl:   text("source_url"),
  status:      text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
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
});

// ─── Versions ─────────────────────────────────────────────────────────────────

export const versions = sqliteTable("versions", {
  id:            text("id").primaryKey(),
  versionNumber: text("version_number").notNull(),
  /** JSON: string[] — 対応 MC バージョン */
  mcVersions:    text("mc_versions").notNull(),
  /** JSON: string[] — 対応ローダー */
  loaders:       text("loaders").notNull(),
  changelog:     text("changelog").notNull(),
  fileUrl:       text("file_url").notNull(),
  fileName:      text("file_name").notNull(),
  fileSize:      integer("file_size"),
  fileSha256:    text("file_sha256"),
  downloads:     integer("downloads").notNull().default(0),
  projectId:     text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt:     integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Project Tags ─────────────────────────────────────────────────────────────

export const projectTags = sqliteTable(
  "project_tags",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.tag] }) })
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
});

// ─── Ideas ────────────────────────────────────────────────────────────────────

export const ideas = sqliteTable("ideas", {
  id:          text("id").primaryKey(),
  title:       text("title").notNull(),
  content:     text("content").notNull(),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status:      text("status", { enum: ["open", "in_progress", "fulfilled"] }).notNull().default("open"),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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
  (t) => ({ pk: primaryKey({ columns: [t.ideaId, t.userId] }) })
);

export const ideaComments = sqliteTable("idea_comments", {
  id:          text("id").primaryKey(),
  ideaId:      text("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  authorId:    text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content:     text("content").notNull(),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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
  (t) => ({ pk: primaryKey({ columns: [t.versionId, t.ideaId] }) })
);

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User        = typeof users.$inferSelect;
export type Project     = typeof projects.$inferSelect;
export type Version     = typeof versions.$inferSelect;
export type Report      = typeof reports.$inferSelect;
export type Idea        = typeof ideas.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
