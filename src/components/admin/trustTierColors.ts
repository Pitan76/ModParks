import type { TrustTier } from "@/db/schema";

/** 段階の色。一覧と詳細で同じ見え方にするため一箇所に持つ */
export const TIER_COLORS: Record<TrustTier, "default" | "error" | "info" | "success" | "primary"> = {
  restricted: "error",
  new: "default",
  member: "info",
  trusted: "success",
  veteran: "primary",
};
