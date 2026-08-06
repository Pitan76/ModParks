/**
 * 信頼ポイントの係数と閾値の既定値。
 *
 * ここにあるのは初期値であって現行値ではない。実運用の値は設定テーブルから読み、
 * 再デプロイなしで調整する。値そのものは秘密ではないので、リポジトリに残してよい
 * （公開されても壊れないことを設計要件にしている）。
 */
import type { TrustEventKind, TrustTier } from "@/db/schema";

/** 全ユーザ共通の出発点。ソーシャル連携は social_linked の加点で表す */
export const TRUST_BASE_SCORE = 50;
export const TRUST_MIN_SCORE  = 0;
export const TRUST_MAX_SCORE  = 1000;

/** 段階の下限値。上から順に評価して最初に満たしたものを採る */
export const TRUST_TIER_FLOORS: ReadonlyArray<readonly [TrustTier, number]> = [
  ["veteran",    700],
  ["trusted",    300],
  ["member",     150],
  ["new",         30],
  ["restricted",   0],
] as const;

/**
 * イベント種別ごとの既定の増減値。
 * malware_detected はここに載せない — 固定値ではなく
 * 「記録時点のスコアを 0 にする値」を記録時に算出するため。
 */
export const TRUST_EVENT_DELTAS: Partial<Record<TrustEventKind, number>> = {
  email_verified:    20,
  two_factor_enabled: 30,
  social_linked:      50,
  account_age_30d:    20,
  account_age_180d:   40,
  account_age_1y:     60,
  account_age_2y:     50,
  account_age_3y:     50,
  account_age_5y:     50,
  version_clean:       5,
  report_upheld:      15,
  appeal_upheld:      40,

  report_upheld_against: -60,
  scan_evasion:         -150,
  report_rejected:        -5,
  report_abuse:         -100,
  dmca_upheld:          -200,
};

/**
 * 同一種別が同時に持てる寄与の上限。
 * 「生涯に数えるイベント数」ではないので、減衰後の寄与の合計に対して掛ける。
 */
export const TRUST_EVENT_CAPS: Partial<Record<TrustEventKind, number>> = {
  version_clean: 200,
  report_upheld: 150,
};

/** 行動由来の加点が減衰しきるまでの日数 */
export const TRUST_DECAY_DAYS = 365;

/** 減点の寄与が半減するまでの日数。malware_detected だけは対象外 */
export const TRUST_PENALTY_HALVE_DAYS = 180;

/** 減衰しない加点。属性由来のものと、性質上一度きりのもの */
export const TRUST_NON_DECAYING_KINDS: ReadonlySet<TrustEventKind> = new Set([
  "email_verified",
  "two_factor_enabled",
  "social_linked",
  "account_age_30d",
  "account_age_180d",
  "account_age_1y",
  "account_age_2y",
  "account_age_3y",
  "account_age_5y",
  "appeal_upheld",
  "manual_grant",
]);

/** 180 日の半減を適用しない減点。マルウェアだけは時間で軽くしない */
export const TRUST_NON_HALVING_DEBIT_KINDS: ReadonlySet<TrustEventKind> = new Set([
  "malware_detected",
]);

/** このスコア以上なら、ヒューリスティック警告つきでも保護観察つきで自動公開する */
export const TRUST_SCAN_RELAXED_SCORE = 500;

/** 在籍期間による加点の刻み。日数の昇順で保つこと */
export const TRUST_ACCOUNT_AGE_STEPS: ReadonlyArray<readonly [TrustEventKind, number]> = [
  ["account_age_30d",   30],
  ["account_age_180d", 180],
  ["account_age_1y",   365],
  ["account_age_2y",   730],
  ["account_age_3y",  1095],
  ["account_age_5y",  1825],
] as const;

/** 最終ログインからこの日数を超えたアカウントには、次の在籍加点を付けない */
export const TRUST_DORMANT_DAYS = 365;
