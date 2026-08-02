/** ポイント台帳・出金申請・還元原資の状況 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "../auth";

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

export type PointAccount     = typeof pointAccounts.$inferSelect;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type PayoutMethod     = typeof payoutMethods.$inferSelect;
export type PayoutRequest    = typeof payoutRequests.$inferSelect;
export type RewardTreasury   = typeof rewardTreasury.$inferSelect;
