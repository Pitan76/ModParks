/**
 * プロジェクトにぶら下がるバージョン（配布ファイル）のテーブル群。
 * 検索最適化用の正規化テーブル（ローダー・対応MCバージョン）も併せて持つ。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects } from "./projects";

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  versionNumber: text("version_number").notNull(),
  /** JSON: string[] - 対応 MC バージョン */
  mcVersions: text("mc_versions").notNull(),
  /** JSON: string[] - 対応ローダー */
  loaders: text("loaders").notNull(),
  changelog: text("changelog").notNull(),
  /** リリースチャネル: release(安定版) / beta / alpha */
  releaseChannel: text("release_channel").notNull().default("release"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  fileSha256: text("file_sha256"),
  downloads: integer("downloads").notNull().default(0),
  /** jar ヒューリスティック検査の判定: pending / clean / suspicious / malicious / skipped */
  scanStatus: text("scan_status").notNull().default("pending"),
  /** JSON: ScanFinding[] - 検出内容。作者・管理者にのみ開示する */
  scanFindings: text("scan_findings"),
  scanAt: integer("scan_at", { mode: "timestamp" }),
  /** アーカイブ日時。null でなければアーカイブ済み（公開一覧・DLから除外、作者のみ閲覧可） */
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  /**
   * このバージョンを実際にアップロードしたユーザ。
   *
   * 共同管理プロジェクトでは投稿者 (posts.authorId) と一致しない。
   * 信頼ポイントの加減点は実行者本人に入れるため、プロジェクトの持ち主とは別に持つ。
   * アカウントを消してもバージョンは残したいので、参照は切って null にする。
   */
  uploaderId: text("uploader_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("versions_project_idx").on(table.projectId),
  index("versions_uploader_idx").on(table.uploaderId),
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

export type Version = typeof versions.$inferSelect;
