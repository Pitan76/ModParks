/**
 * 通知に埋め込むスキャン関連のラベル。
 *
 * 通知は「テンプレートは表示時に翻訳、パラメータは作成時に確定」という作りなので、
 * ここの文言だけは受信者のロケールに追従できない（作成時点で受信者のロケールが分からない）。
 * 現状は日英併記でどちらの利用者にも読めるようにしている。
 * 恒久対応するなら、パラメータ側もキーで保存し、表示時に解決する必要がある。
 */

/** スキャン判定のラベル。versionScan の自動判定と、管理者の手動上書きで共有する */
export const SCAN_STATUS_LABELS: Record<string, string> = {
  malicious: "悪質 (malicious)",
  suspicious: "疑わしい (suspicious)",
  failed: "スキャン失敗 (failed)",
};

export const scanStatusLabel = (status: string): string =>
  SCAN_STATUS_LABELS[status] ?? SCAN_STATUS_LABELS.failed;

/** 異議申請の裁定結果のラベル */
export const APPEAL_DECISION_LABELS: Record<"approved" | "rejected", string> = {
  approved: "承認 (approved)",
  rejected: "却下 (rejected)",
};

/** 裁定コメントが未入力のときに通知本文へ出す代替文言 */
export const NO_REVIEW_NOTE = "なし";
