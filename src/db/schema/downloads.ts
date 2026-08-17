/**
 * ダウンロード計数の日次バッファ。
 *
 * 従来は 1 ダウンロードごとに versions / projects の累積カウンタを直接 UPDATE していたが、
 * 攻撃時に書き込みが攻撃規模へ比例して増えるうえ、同一行への集中更新が競合を生んでいた。
 * ここへ日単位で積み、Cron が差分だけを累積カウンタへ反映する。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";
import { versions } from "./versions";

export const versionDownloadDaily = sqliteTable("version_download_daily", {
  versionId: text("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  /** ロールアップ時に projects を引き直さずに済むよう非正規化して持つ */
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** UTC 基準の epoch day (unixepoch() / 86400) */
  date: integer("date").notNull(),
  count: integer("count").notNull().default(0),
  /**
   * 累積カウンタへ反映済みの件数。
   * count との差分だけを加算することで、ロールアップの再実行や
   * 途中失敗があっても二重加算にならないようにする。
   */
  syncedCount: integer("synced_count").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.versionId, t.date] }),
  dateIdx: index("version_download_daily_date_idx").on(t.date),
}));

export type VersionDownloadDaily = typeof versionDownloadDaily.$inferSelect;
