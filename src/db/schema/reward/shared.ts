/**
 * クリエイタ還元 (Creator Reward) 全体で共有する列挙。
 * 複数テーブルの enum 定義に使うため、テーブル定義より先に独立させている。
 */

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
