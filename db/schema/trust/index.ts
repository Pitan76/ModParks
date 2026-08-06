/**
 * 信頼ポイント (Trust Credit) のテーブル。
 *
 * trust_events が唯一の真実で、追記のみ行う。UPDATE / DELETE はしない。
 * 誤判定の取り消しは reversal イベントの追加で表す。
 * user_trust は台帳から再構築できる参照用のキャッシュで、判定パスはこちらだけを読む。
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "../auth";
import {
  TRUST_EVENT_KINDS,
  TRUST_SUBJECT_TYPES,
  TRUST_TIERS,
} from "./shared";

export * from "./shared";

// ---- 台帳 ----

export const trustEvents = sqliteTable("trust_events", {
  id:     text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind:   text("kind", { enum: TRUST_EVENT_KINDS }).notNull(),

  /**
   * 符号付きの生の値。減衰前・上限適用前。
   * malware_detected だけは固定値ではなく、記録時点のスコアを 0 にする値を入れる。
   */
  delta:  integer("delta").notNull(),

  /** false なら減衰対象外（属性由来の加点と、全ての減点） */
  decays: integer("decays", { mode: "boolean" }).notNull().default(false),

  subjectType: text("subject_type", { enum: TRUST_SUBJECT_TYPES })
    .notNull()
    .default("none"),
  /**
   * 冪等性キーの一部。対象を持たないイベントは空文字を入れる。
   * SQLite の unique 制約は NULL 同士を重複と見なさないため、
   * null にすると二重加点を制約で防げなくなる。
   */
  subjectId: text("subject_id").notNull().default(""),

  /** 打ち消し対象。kind が reversal のときだけ入る */
  reversesEventId: text("reverses_event_id"),

  /** 管理者操作では必須。運用ルールであってスキーマ制約ではない */
  reason: text("reason"),
  /** 手動操作した管理者。他の監査ログと同様に非正規化して保持する */
  actorEmail: text("actor_email"),

  /** 減衰の起点。記録時刻ではなく事象が起きた時刻を入れる */
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  createdAt:  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  subjectUniq: uniqueIndex("trust_events_subject_uniq")
    .on(t.userId, t.kind, t.subjectId),
  userIdx:     index("trust_events_user_idx").on(t.userId, t.occurredAt),
  reversesIdx: index("trust_events_reverses_idx").on(t.reversesEventId),
}));

// ---- 参照用キャッシュ ----

export const userTrust = sqliteTable("user_trust", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  score: integer("score").notNull().default(50),
  tier:  text("tier", { enum: TRUST_TIERS }).notNull().default("new"),

  /** true の間は自動「加点」だけを止める。減点は常に反映する */
  frozen: integer("frozen", { mode: "boolean" }).notNull().default(false),

  /** 管理者が段階を直接指定した場合の上書き。null ならスコアから導出する */
  tierOverride:      text("tier_override", { enum: TRUST_TIERS }),
  tierOverrideUntil: integer("tier_override_until", { mode: "timestamp" }),

  computedAt: integer("computed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  computedIdx: index("user_trust_computed_idx").on(t.computedAt),
  tierIdx:     index("user_trust_tier_idx").on(t.tier),
}));

export type TrustEvent = typeof trustEvents.$inferSelect;
export type UserTrust  = typeof userTrust.$inferSelect;
