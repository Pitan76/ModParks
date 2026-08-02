/** 期間ごとのプール確定と、ユーザー・プロジェクトへの配分結果 */
import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";
import { users } from "../auth";
import { projects } from "../projects";
import { REWARD_SOURCES, REWARD_PERIOD_STATUSES } from "./shared";

export const rewardPeriods = sqliteTable("reward_periods", {
  /** "YYYY-MM" */
  id: text("id").primaryKey(),
  status: text("status", { enum: REWARD_PERIOD_STATUSES }).notNull().default("draft"),
  poolTotalMinor: integer("pool_total_minor").notNull().default(0),
  /** 前期からの繰越端数 */
  carriedInMinor: integer("carried_in_minor").notNull().default(0),
  /** 次期へ繰り越す端数 */
  carriedOutMinor: integer("carried_out_minor").notNull().default(0),
  /** 計算時点の重み・上限・還元率のスナップショット。後から設定を変えても過去は動かさない */
  weights: text("weights", { mode: "json" }).$type<Record<string, number>>(),
  calculatedAt: integer("calculated_at", { mode: "timestamp" }),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  distributedAt: integer("distributed_at", { mode: "timestamp" }),
  approvedByEmail: text("approved_by_email"),
  /** status = failed のときの理由 */
  failureReason: text("failure_reason"),
}, (t) => ({
  statusIdx: index("reward_periods_status_idx").on(t.status),
}));

export const revenuePools = sqliteTable("revenue_pools", {
  periodId: text("period_id")
    .notNull()
    .references(() => rewardPeriods.id, { onDelete: "cascade" }),
  source: text("source", { enum: REWARD_SOURCES }).notNull(),
  /** この収益源に按分された純額 (原価・準備金控除後) */
  netMinor: integer("net_minor").notNull().default(0),
  payoutRatio: real("payout_ratio").notNull(),
  /** 上限適用後の確定プール */
  poolMinor: integer("pool_minor").notNull().default(0),
  /** このプールを配分する対象メトリクス */
  allocationMetric: text("allocation_metric", {
    enum: ["free_views", "premium_views", "all_views"],
  }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.periodId, t.source] }),
}));

/** 期間 × ユーザーの確定報酬。分配前の計算結果であり、残高はまだ動いていない */
export const rewardAllocations = sqliteTable("reward_allocations", {
  periodId: text("period_id")
    .notNull()
    .references(() => rewardPeriods.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  /** プロジェクト別・収益源別の内訳 */
  breakdown: text("breakdown", { mode: "json" }).$type<Record<string, unknown>>(),
}, (t) => ({
  pk: primaryKey({ columns: [t.periodId, t.userId] }),
  userIdx: index("reward_allocations_user_idx").on(t.userId),
}));

/** プロジェクト内の分配比率。行が無ければ作者 100% として扱う */
export const projectRewardShares = sqliteTable("project_reward_shares", {
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 万分率。プロジェクト内の合計が 10000 になること */
  shareBps: integer("share_bps").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.userId] }),
}));

export type RewardPeriod       = typeof rewardPeriods.$inferSelect;
export type RevenuePool        = typeof revenuePools.$inferSelect;
export type RewardAllocation   = typeof rewardAllocations.$inferSelect;
export type ProjectRewardShare = typeof projectRewardShares.$inferSelect;
