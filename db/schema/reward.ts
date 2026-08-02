/**
 * クリエイタ還元 (Creator Reward) のスキーマ。
 * 金額はすべて最小通貨単位の整数 (JPY なら円) で保持し、浮動小数は比率のみに使う。
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects } from "./projects";

/** 収益源。プレミアム購読を追加してもここに足すだけで済むようにしている */
export const REWARD_SOURCES = ["ads", "subscription", "donation", "other"] as const;
export type RewardSource = (typeof REWARD_SOURCES)[number];

/** 期間の状態遷移。分配は approved を経由しないと実行できない */
export const REWARD_PERIOD_STATUSES = [
  "draft",
  "calculated",
  "approved",
  "distributed",
  "failed",
] as const;

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

export type ProjectMetricDaily = typeof projectMetricDaily.$inferSelect;

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

export type RevenueEntry = typeof revenueEntries.$inferSelect;

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

export type CostEntry = typeof costEntries.$inferSelect;

// ---- 期間・プール・配分 ----

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

export type RewardPeriod = typeof rewardPeriods.$inferSelect;

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

export type RevenuePool = typeof revenuePools.$inferSelect;

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

export type RewardAllocation = typeof rewardAllocations.$inferSelect;

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

export type ProjectRewardShare = typeof projectRewardShares.$inferSelect;

// ---- ポイント台帳 ----

/** 残高は point_transactions から再構築できる。ここは参照用のキャッシュ */
export const pointAccounts = sqliteTable("point_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PointAccount = typeof pointAccounts.$inferSelect;

/**
 * ポイントの取引台帳。追記専用で UPDATE / DELETE しない。
 * 訂正は逆仕訳 (adjustment) を追加して表現する。
 */
export const pointTransactions = sqliteTable("point_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 正 = 付与 / 負 = 消費 */
  amount: integer("amount").notNull(),
  type: text("type", {
    enum: ["reward", "adjustment", "spend", "payout", "expire"],
  }).notNull(),
  periodId: text("period_id"),
  payoutRequestId: text("payout_request_id"),
  reason: text("reason"),
  /** 例 "reward:2026-07:<userId>"。バッチ再実行時の二重付与を防ぐ */
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  userIdx: index("point_transactions_user_idx").on(t.userId, t.createdAt),
}));

export type PointTransaction = typeof pointTransactions.$inferSelect;

// ---- 出金 ----

export const payoutMethods = sqliteTable("payout_methods", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["paypal", "giftcard"] }).notNull(),
  /** PayPal メールなどの送金先。暗号化して保持する */
  destination: text("destination").notNull(),
  /** 一覧での識別用。末尾のみなど、復号せず表示できる文字列 */
  displayHint: text("display_hint"),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  userIdx: index("payout_methods_user_idx").on(t.userId),
}));

export type PayoutMethod = typeof payoutMethods.$inferSelect;

/** 税務記録として永久保持する。削除しない */
export const payoutRequests = sqliteTable("payout_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  methodId: text("method_id")
    .notNull()
    .references(() => payoutMethods.id),
  /** 申請時に残高から引き当てたポイント */
  points: integer("points").notNull(),
  /** 手数料控除後の受取額 */
  amountMinor: integer("amount_minor").notNull(),
  feeMinor: integer("fee_minor").notNull().default(0),
  status: text("status", {
    enum: ["requested", "reviewing", "approved", "sent", "rejected", "failed"],
  }).notNull().default("requested"),
  /** PayPal payout batch id / ギフトカード発行 ID */
  externalRef: text("external_ref"),
  requestedAt: integer("requested_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  processedAt: integer("processed_at", { mode: "timestamp" }),
  processedByEmail: text("processed_by_email"),
  rejectReason: text("reject_reason"),
}, (t) => ({
  statusIdx: index("payout_requests_status_idx").on(t.status, t.requestedAt),
  userIdx: index("payout_requests_user_idx").on(t.userId),
}));

export type PayoutRequest = typeof payoutRequests.$inferSelect;

// ---- 資金状況 ----

/**
 * 還元原資の現金・準備金・ポイント負債。単一行 (key = 'global')。
 *
 * cashMinor >= liabilityMinor を常に満たすことが不変条件で、
 * これが崩れる額のプールは作らない。
 */
export const rewardTreasury = sqliteTable("reward_treasury", {
  treasuryKey: text("treasury_key").primaryKey(),
  /** 還元用に確保している現金 */
  cashMinor: integer("cash_minor").notNull().default(0),
  /** 収益変動を吸収する準備金の積立残高 */
  reserveMinor: integer("reserve_minor").notNull().default(0),
  /** 未出金ポイント総額 */
  liabilityMinor: integer("liability_minor").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type RewardTreasury = typeof rewardTreasury.$inferSelect;
