import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id:          text("id").primaryKey(),
  githubId:    text("github_id").unique().notNull(),
  username:    text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl:   text("avatar_url"),
  bio:         text("bio"),
  role:        text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt:   integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User    = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Report  = typeof reports.$inferSelect;
