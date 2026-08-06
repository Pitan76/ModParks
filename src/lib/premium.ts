/**
 * プレミアム判定のユーティリティ。
 *
 * 現状は販売しておらず、管理画面 (/admin/users) からの手動付与のみ。
 * 将来決済を入れる場合も、判定はここに集約したまま付与元だけを増やす。
 */

/** users.premium_until は timestamp(秒) 列。Date / 秒 / ミリ秒のいずれで来ても比較できるようにする */
function toMillis(value: Date | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  // 秒で保存された値がそのまま渡ってくるケースを吸収する
  return value < 1e12 ? value * 1000 : value;
}

export interface PremiumFields {
  premiumTier?: string | null;
  premiumUntil?: Date | number | null;
}

/**
 * プレミアムが現在有効かどうか。
 * premiumUntil が null の付与は無期限扱い。
 */
export function isPremiumActive(user: PremiumFields | null | undefined): boolean {
  if (!user || user.premiumTier !== "premium") return false;
  const until = toMillis(user.premiumUntil);
  return until === null || until > Date.now();
}

/** 期限切れを含めた表示用の状態 */
export function getPremiumState(user: PremiumFields | null | undefined): "none" | "active" | "expired" {
  if (!user || user.premiumTier !== "premium") return "none";
  return isPremiumActive(user) ? "active" : "expired";
}

export { toMillis as premiumUntilMillis };
