/**
 * 通報・異議申請と各種監査ログ。
 *
 * 監査ログ系は users への外部キーを意図的に張っていない。users を参照すると、
 * バックアップ復元時の users 全削除に連動してログ自体がカスケード削除されてしまうため。
 * 代わりに操作時点のメールアドレスを非正規化して保持する。
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects, versions } from "./projects";
import { ideas } from "./ideas";
import { comments } from "./posts";

// ---- Reports ----

export const reports = sqliteTable("reports", {
  id:         text("id").primaryKey(),
  targetType: text("target_type", {
    enum: ["project", "idea", "comment", "user"],
  }).notNull().default("project"),
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
    .references(() => projects.id, { onDelete: "cascade" }),
  ideaId:     text("idea_id")
    .references(() => ideas.id, { onDelete: "cascade" }),
  commentId:  text("comment_id")
    .references(() => comments.id, { onDelete: "cascade" }),
  userId:     text("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt:  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  reporterIdx: index("reports_reporter_idx").on(table.reporterId),
  projectIdx:  index("reports_project_idx").on(table.projectId),
  ideaIdx:     index("reports_idea_idx").on(table.ideaId),
  commentIdx:  index("reports_comment_idx").on(table.commentId),
  userIdx:     index("reports_user_idx").on(table.userId),
}));

// ---- Scan Appeals ----

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

// ---- Settings Audit ----

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
  /** 変更者の users.id。外部キーを張らない理由はファイル冒頭を参照 */
  changedBy: text("changed_by").notNull(),
  changedByEmail: text("changed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  scopeIdx: index("settings_audit_scope_idx").on(table.scope, table.createdAt),
}));

// ---- Backup Audit ----

/**
 * バックアップ・復元操作の監査ログ。
 *
 * 復元は全テーブルを削除して入れ替えるため、このテーブルは意図的に
 * バックアップ／復元の対象（adminBackup.ts の SCHEMA_TABLES）に含めていません。
 * 復元をまたいでログが残ることで「いつ誰がどのデータに戻したか」を追跡できます。
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

// ---- Moderation Audit ----

/** 管理者によるモデレーション操作（通報対応・非公開化・権限変更・スキャン異議裁定など）の監査ログ */
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
      // 異議申請を経ずに管理者がスキャン判定を直接覆した場合
      "scan_override",
      "suspend_user",
      "unsuspend_user",
      "premium_grant",
      "premium_revoke",
      // 信頼ポイント。段階の上書きと打ち消しは、誰がいつ何を理由に行ったか追えないと運用が破綻する
      "trust_adjust",
      "trust_tier_override",
      "trust_freeze",
      "trust_event_reverse",
      "trust_recompute",
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

// ---- Deleted Records (墓標) ----

/**
 * 削除された行の墓標。
 *
 * マージ復元で「バックアップ後に削除された行」が復活するのを防ぐために使います。
 * 行そのものは従来通り物理削除するため、通常の読み取りクエリには影響しません
 * （論理削除にすると全ての SELECT に isNull(deletedAt) が必要になる）。
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

export type Report          = typeof reports.$inferSelect;
export type SettingsAudit   = typeof settingsAudit.$inferSelect;
export type BackupAudit     = typeof backupAudit.$inferSelect;
export type ModerationAudit = typeof moderationAudit.$inferSelect;
export type DeletedRecord   = typeof deletedRecords.$inferSelect;
