/**
 * 配分計算の入力となる実測値と金銭記録。
 * 金額はすべて最小通貨単位の整数 (JPY なら円) で保持する。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "../projects";
import { REWARD_SOURCES } from "./shared";

// ---- 日次メトリクス ----

/**
 * プロジェクト単位の日次実測値。配分スコアの唯一の入力。
 *
 * projects.downloads は累積カウンタで期間差分が取れないため別途持つ。
 * viewerTier で分けているのは、広告を見ないプレミアム閲覧者を
 * 広告プールの配分対象から外せるようにするため。
 */
export const projectMetricDaily = sqliteTable("project_metric_daily", {
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** UTC 基準の epoch day (unixepoch() / 86400) */
  date: integer("date").notNull(),
  viewerTier: text("viewer_tier", { enum: ["free", "premium"] }).notNull(),
  pageViews: integer("page_views").notNull().default(0),
  downloads: integer("downloads").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.date, t.viewerTier] }),
  dateIdx: index("project_metric_daily_date_idx").on(t.date),
}));

// ---- 収益と原価 ----

/**
 * 実際に着金した収益。発生額ではなく入金額のみを記録する。
 * 未着金の期間は行が存在せず、その月のプールは 0 になる。
 */
export const revenueEntries = sqliteTable("revenue_entries", {
  id: text("id").primaryKey(),
  /** 収益が発生した月 "YYYY-MM" */
  period: text("period").notNull(),
  source: text("source", { enum: REWARD_SOURCES }).notNull(),
  /** 手数料・税を控除した着金ベースの金額 */
  amountMinor: integer("amount_minor").notNull(),
  settledAt: integer("settled_at", { mode: "timestamp" }).notNull(),
  currency: text("currency").notNull().default("JPY"),
  note: text("note"),
  /** AdSense payments.list の Payment.name。重複取込の防止に使う */
  externalRef: text("external_ref"),
  recordedByEmail: text("recorded_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  periodIdx: index("revenue_entries_period_idx").on(t.period, t.source),
  externalRefIdx: index("revenue_entries_external_ref_idx").on(t.externalRef),
}));

/** 還元は売上ではなく利益の分配にするため、期間ごとの原価を控除する */
export const costEntries = sqliteTable("cost_entries", {
  id: text("id").primaryKey(),
  period: text("period").notNull(),
  category: text("category", {
    enum: ["infra", "domain", "storage", "payout_fee", "service", "other"],
  }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  /** 毎月発生する固定費。翌月の下書き自動生成に使う */
  recurring: integer("recurring", { mode: "boolean" }).notNull().default(false),
  note: text("note"),
  recordedByEmail: text("recorded_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  periodIdx: index("cost_entries_period_idx").on(t.period),
}));

export type ProjectMetricDaily = typeof projectMetricDaily.$inferSelect;
export type RevenueEntry       = typeof revenueEntries.$inferSelect;
export type CostEntry          = typeof costEntries.$inferSelect;
