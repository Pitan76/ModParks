/**
 * 自動DDoS防御システムのテーブル群。
 * 書き込み元は Worker 側（worker/ 配下）で、管理画面は状態表示と手動操作にのみ使う。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const ddosSlices = sqliteTable("ddos_slices", {
  sliceTime:          integer("slice_time").notNull(),       // 10秒単位のEpoch秒
  isolateId:          text("isolate_id").notNull(),          // Worker IsolateのランダムID
  requestCount:       integer("request_count").notNull(),    // 期間内の総アクセス数
  downloadCount:      integer("download_count").notNull(),   // /api/download アクセス数
  uniqueIpCount:      integer("unique_ip_count").notNull(),  // Isolate内ユニークIP数 (上限1000)
  uniqueCountryCount: integer("unique_country_count").notNull(), // Isolate内ユニーク国数
  topSlug:            text("top_slug"),                       // 最多アクセスのslug
  topSlugCount:       integer("top_slug_count"),              // そのslugへのアクセス数
}, (t) => [
  primaryKey({ columns: [t.sliceTime, t.isolateId] })
]);

export const ddosState = sqliteTable("ddos_state", {
  stateKey:             text("state_key").primaryKey(),       // 値は常に 'global'
  currentState:         text("current_state").notNull(),      // ステータス名
  attackDetectedAt:     integer("attack_detected_at").notNull(),
  underAttackEnabledAt: integer("under_attack_enabled_at").notNull(),
  scheduledDisableAt:   integer("scheduled_disable_at").notNull(),
  cooldownUntil:        integer("cooldown_until").notNull(),
  updatedAt:            integer("updated_at").notNull(),
  protectionDuration:   integer("protection_duration").notNull(), // 防護適用時間 (ms)
  lastNormalAt:         integer("last_normal_at").notNull(),  // 最終 NORMAL 遷移時刻 (ms)
});

/**
 * DDoS 防護の状態遷移の監査ログ。
 *
 * ddos_state は「今どうなっているか」しか持たず、Discord 通知も流れて消えるため、
 * 「いつ・何をきっかけに防護が入り、いつ外れたか」を後から追える記録をここに残す。
 *
 * 他の監査ログと同様、users への外部キーは張らず操作時点のメールを非正規化して保持する。
 * 自動検知や Cron による遷移では performed_by は null（システム実行）になる。
 */
export const ddosAudit = sqliteTable("ddos_audit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  action: text("action", {
    enum: [
      /** 自動検知による WAF 有効化（UNDER_ATTACK 突入） */
      "auto_activate",
      /** 攻撃検知したが Cloudflare API に失敗し COOLDOWN へ退避 */
      "auto_activate_failed",
      /** 防護期限切れによる Cron の自動解除 */
      "auto_deactivate",
      /** 自動解除の Cloudflare API 失敗（UNDER_ATTACK へ差し戻し） */
      "auto_deactivate_failed",
      /** 管理者による手動の防護有効化 */
      "manual_activate",
      /** 管理者による手動の防護解除 */
      "manual_deactivate",
      /** ACTIVATING / DEACTIVATING でスタックした状態の Cron による復旧 */
      "recover",
    ],
  }).notNull(),
  /** 遷移後の ddos_state.current_state */
  state: text("state").notNull(),
  /** 検知メトリクス・対象 slug・防護時間・エラー内容などを JSON で保持する */
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  /** 操作者の users.id。自動検知・Cron による遷移では null */
  performedBy: text("performed_by"),
  performedByEmail: text("performed_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  actionIdx: index("ddos_audit_action_idx").on(table.action, table.createdAt),
}));

export type DdosSlice      = typeof ddosSlices.$inferSelect;
export type DdosStateModel = typeof ddosState.$inferSelect;
export type DdosAudit      = typeof ddosAudit.$inferSelect;
