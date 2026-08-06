/**
 * 台帳からスコアと段階を導出する純粋計算。
 * DB に触れないので、この層だけでロジックのテストが完結する。
 */
import type { TrustEvent, TrustEventKind, TrustTier } from "@/db/schema";
import {
  TRUST_BASE_SCORE,
  TRUST_DECAY_DAYS,
  TRUST_EVENT_CAPS,
  TRUST_MAX_SCORE,
  TRUST_MIN_SCORE,
  TRUST_NON_HALVING_DEBIT_KINDS,
  TRUST_PENALTY_HALVE_DAYS,
  TRUST_TIER_FLOORS,
} from "./config";

const DAY_MS = 86_400_000;

/** 打ち消し済みでない、スコアに効くイベントだけを残す */
function activeEvents(events: readonly TrustEvent[]): TrustEvent[] {
  const reversed = new Set(
    events.flatMap((e) => (e.reversesEventId ? [e.reversesEventId] : [])),
  );
  return events.filter((e) => e.kind !== "reversal" && !reversed.has(e.id));
}

function ageInDays(occurredAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - occurredAt.getTime()) / DAY_MS);
}

/**
 * 減衰と半減を適用した後の寄与。上限はここでは掛けない
 * （上限は種別ごとの合計に対して掛けるため、→ contributionByKind）。
 */
export function effectiveDelta(event: TrustEvent, now: Date): number {
  const age = ageInDays(event.occurredAt, now);

  if (event.delta < 0) {
    if (TRUST_NON_HALVING_DEBIT_KINDS.has(event.kind)) return event.delta;
    if (age <= TRUST_PENALTY_HALVE_DAYS) return event.delta;
    return Math.round(event.delta / 2);
  }

  if (!event.decays) return event.delta;

  const remaining = Math.max(0, 1 - age / TRUST_DECAY_DAYS);
  return Math.round(event.delta * remaining);
}

/**
 * 種別ごとに寄与を合計し、上限で頭打ちにする。
 *
 * 古いイベントから数えて打ち切ってはいけない。減衰しきって寄与が 0 になった
 * イベントが枠を占有し続け、投稿を続けているのにスコアが下がる状態になる。
 */
function contributionByKind(
  events: readonly TrustEvent[],
  now: Date,
  includeCredits: boolean,
): Map<TrustEventKind, number> {
  const totals = new Map<TrustEventKind, number>();

  for (const event of events) {
    if (!includeCredits && event.delta > 0) continue;
    totals.set(event.kind, (totals.get(event.kind) ?? 0) + effectiveDelta(event, now));
  }

  for (const [kind, total] of totals) {
    const cap = TRUST_EVENT_CAPS[kind];
    if (cap !== undefined) totals.set(kind, Math.min(cap, total));
  }
  return totals;
}

export type ScoreOptions = {
  /** true の間は自動加点を無視する。減点は常に反映する */
  frozen?: boolean;
  now?: Date;
};

/** 台帳からスコアを計算する。この結果が user_trust.score の唯一の出所 */
export function computeScore(
  events: readonly TrustEvent[],
  options: ScoreOptions = {},
): number {
  const now = options.now ?? new Date();
  const totals = contributionByKind(activeEvents(events), now, !options.frozen);

  let score = TRUST_BASE_SCORE;
  for (const total of totals.values()) score += total;

  return Math.min(TRUST_MAX_SCORE, Math.max(TRUST_MIN_SCORE, Math.round(score)));
}

/** スコアから段階を導出する。上書きの適用は呼び出し側 (resolveTier) の責務 */
export function tierFromScore(score: number): TrustTier {
  for (const [tier, floor] of TRUST_TIER_FLOORS) {
    if (score >= floor) return tier;
  }
  return "restricted";
}

export type TierOverride = {
  tierOverride: TrustTier | null;
  tierOverrideUntil: Date | null;
};

/** 管理者による段階の上書きを考慮した、実際に権限判定へ使う段階 */
export function resolveTier(
  score: number,
  override: TierOverride | null = null,
  now: Date = new Date(),
): TrustTier {
  if (!override?.tierOverride) return tierFromScore(score);
  if (override.tierOverrideUntil && override.tierOverrideUntil <= now) {
    return tierFromScore(score);
  }
  return override.tierOverride;
}
