/**
 * 信頼ポイント (Trust Credit) 全体で共有する列挙。
 * 複数テーブルの enum 定義とスコア計算の双方から参照するため、
 * テーブル定義より先に独立させている。
 */

/** 段階。実際の権限判定はスコアの生値ではなくこれで行う */
export const TRUST_TIERS = ["restricted", "new", "member", "trusted", "veteran"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

/** 加点イベント。属性由来は減衰せず、行動由来は 365 日で寄与が 0 になる */
export const TRUST_CREDIT_KINDS = [
  "email_verified",
  "two_factor_enabled",
  "social_linked",
  "account_age_30d",
  "account_age_180d",
  "account_age_1y",
  "account_age_2y",
  "account_age_3y",
  "account_age_5y",
  "version_clean",
  "report_upheld",
  "appeal_upheld",
  "manual_grant",
] as const;

/** 減点イベント。記録は即時で、加点のような遅延は挟まない */
export const TRUST_DEBIT_KINDS = [
  "report_upheld_against",
  "malware_detected",
  "scan_evasion",
  "report_rejected",
  "report_abuse",
  "dmca_upheld",
  "manual_penalty",
] as const;

/**
 * 既存イベントの打ち消し。
 * 台帳は追記専用なので、誤判定の取り消しは行の削除ではなくこの種別の追加で表す。
 */
export const TRUST_REVERSAL_KIND = "reversal" as const;

export const TRUST_EVENT_KINDS = [
  ...TRUST_CREDIT_KINDS,
  ...TRUST_DEBIT_KINDS,
  TRUST_REVERSAL_KIND,
] as const;
export type TrustEventKind = (typeof TRUST_EVENT_KINDS)[number];

/** 台帳に対象を持たないイベントを積むときの subjectId。null は使わない（→ 下記） */
export const TRUST_NO_SUBJECT = "" as const;

export const TRUST_SUBJECT_TYPES = [
  "project",
  "version",
  "comment",
  "report",
  "appeal",
  "user",
  "none",
] as const;
export type TrustSubjectType = (typeof TRUST_SUBJECT_TYPES)[number];
