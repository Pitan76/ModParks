/**
 * 利用量の日次サマリ。
 *
 * 予算アラートとコスト概要の唯一の入力。専用の計測基盤は建てず、
 * 既に収集している ddos_slices と version_download_daily を日次へ畳んで持つ。
 *
 * 月次の値は日次行の合計で導出する。逆は導出できないため、
 * Paid へ移っても行の粒度は日次のまま変えない。
 */
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const usageDaily = sqliteTable("usage_daily", {
  /** UTC 基準の epoch day (unixepoch() / 86400) */
  date: integer("date").primaryKey(),
  /** 総リクエスト数。ddos_slices の合計 */
  requests: integer("requests").notNull().default(0),
  /** /api/download へのリクエスト数。計上の可否を問わない */
  downloads: integer("downloads").notNull().default(0),
  /** Bot と判定されたリクエスト数 */
  botRequests: integer("bot_requests").notNull().default(0),
  /** Bot と判定されたダウンロード数 */
  botDownloads: integer("bot_downloads").notNull().default(0),
  /** 実際に統計へ計上したダウンロード数。version_download_daily の合計 */
  downloadsCounted: integer("downloads_counted").notNull().default(0),
  /** ロールアップ実行時刻(ms)。当日の行は繰り返し更新される */
  updatedAt: integer("updated_at").notNull(),
});

export type UsageDaily = typeof usageDaily.$inferSelect;

/**
 * 予算アラートの通知済み状態。
 *
 * 判定は毎時走るため、同じ深刻度で鳴らし続けるとアラートが無視されるようになる。
 * 期間ごとに「どこまで通知したか」を持ち、深刻度が上がったときだけ通知する。
 */
export const usageAlertState = sqliteTable("usage_alert_state", {
  /** 判定期間。free は "YYYY-MM-DD"、paid は "YYYY-MM" */
  periodKey: text("period_key").primaryKey(),
  /** 最後に通知した深刻度 */
  level: text("level").notNull(),
  notifiedAt: integer("notified_at").notNull(),
});

export type UsageAlertState = typeof usageAlertState.$inferSelect;
