/**
 * 管理画面の信頼ポイント。
 *
 * スコアを見られるのは管理者とシステムだけなので、ここが唯一の閲覧窓口になる。
 * 「なぜ今この値なのか」を画面だけで追えるよう、台帳の生値と減衰後の寄与を併せて返す。
 */
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import {
  trustEvents,
  userTrust,
  users,
  userProfiles,
  type TrustTier,
} from "@/db/schema";
import { effectiveDelta, resolveTier, tierFromScore } from "@/lib/trust/score";
import { TRUST_TIER_FLOORS } from "@/lib/trust/config";

export const TRUST_PAGE_SIZE = 50;

/** 一覧の絞り込み。段階に加えて、人が介入した行だけを抜ける */
export type TrustFilter = TrustTier | "all" | "frozen" | "overridden";

export type TrustListRow = {
  userId: string;
  username: string | null;
  email: string | null;
  score: number;
  tier: TrustTier;
  frozen: boolean;
  overridden: boolean;
  computedAt: Date;
};

function filterCondition(filter: TrustFilter) {
  if (filter === "all") return undefined;
  if (filter === "frozen") return eq(userTrust.frozen, true);
  if (filter === "overridden") return sql`${userTrust.tierOverride} is not null`;
  return eq(userTrust.tier, filter);
}

/** 一覧。スコアの低い順に並べる（対処が要るのは下から） */
export async function getTrustList(
  filter: TrustFilter,
  page: number,
  search?: string,
): Promise<TrustListRow[]> {
  const db = await getDatabase();
  const keyword = search?.trim();

  const rows = await db
    .select({
      userId: userTrust.userId,
      username: userProfiles.username,
      email: users.email,
      score: userTrust.score,
      tier: userTrust.tier,
      frozen: userTrust.frozen,
      tierOverride: userTrust.tierOverride,
      tierOverrideUntil: userTrust.tierOverrideUntil,
      computedAt: userTrust.computedAt,
    })
    .from(userTrust)
    .innerJoin(users, eq(users.id, userTrust.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, userTrust.userId))
    .where(and(
      filterCondition(filter),
      keyword
        ? or(like(userProfiles.username, `%${keyword}%`), like(users.email, `%${keyword}%`))
        : undefined,
    ))
    .orderBy(userTrust.score)
    .limit(TRUST_PAGE_SIZE)
    .offset(Math.max(0, page - 1) * TRUST_PAGE_SIZE)
    .all();

  const now = new Date();
  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    email: row.email,
    score: row.score,
    tier: resolveTier(row.score, row, now),
    frozen: row.frozen,
    overridden: resolveTier(row.score, row, now) !== tierFromScore(row.score),
    computedAt: row.computedAt,
  }));
}

/** ページャ用の総件数。絞り込み条件は一覧と同じものを使う */
export async function countTrustList(filter: TrustFilter, search?: string): Promise<number> {
  const db = await getDatabase();
  const keyword = search?.trim();

  const row = await db
    .select({ total: sql<number>`count(*)` })
    .from(userTrust)
    .innerJoin(users, eq(users.id, userTrust.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, userTrust.userId))
    .where(and(
      filterCondition(filter),
      keyword
        ? or(like(userProfiles.username, `%${keyword}%`), like(users.email, `%${keyword}%`))
        : undefined,
    ))
    .get();

  return Number(row?.total ?? 0);
}

/** 段階ごとの人数。係数が妥当かはこの分布で判断する（→ memo/TRUST_CREDIT.md 8章） */
export async function getTrustDistribution(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db
    .select({ tier: userTrust.tier, count: sql<number>`count(*)` })
    .from(userTrust)
    .groupBy(userTrust.tier)
    .all();

  const distribution: Record<string, number> = {};
  for (const [tier] of TRUST_TIER_FLOORS) distribution[tier] = 0;
  for (const row of rows) distribution[row.tier] = Number(row.count);
  return distribution;
}

export type TrustEventRow = {
  id: string;
  kind: string;
  /** 台帳に記録された生の値 */
  delta: number;
  /** 減衰・半減を適用した後の、今この瞬間の寄与 */
  effective: number;
  reversed: boolean;
  reversesEventId: string | null;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  actorEmail: string | null;
  occurredAt: Date;
};

export type TrustDetail = {
  userId: string;
  username: string | null;
  email: string | null;
  score: number;
  tier: TrustTier;
  /** 次の段階まであといくつか。最上位なら null */
  toNextTier: number | null;
  frozen: boolean;
  tierOverride: TrustTier | null;
  tierOverrideUntil: Date | null;
  events: TrustEventRow[];
};

/** 上の段階の下限を引く。詳細画面で「あと何点か」を出すため */
function distanceToNextTier(score: number): number | null {
  const higher = [...TRUST_TIER_FLOORS]
    .map(([, floor]) => floor)
    .filter((floor) => floor > score)
    .sort((a, b) => a - b);

  return higher.length > 0 ? higher[0] - score : null;
}

/** 詳細。台帳は全件返す（件数が増えたらページングを足す） */
export async function getTrustDetail(userId: string): Promise<TrustDetail | null> {
  const db = await getDatabase();

  const state = await db
    .select({
      userId: userTrust.userId,
      username: userProfiles.username,
      email: users.email,
      score: userTrust.score,
      frozen: userTrust.frozen,
      tierOverride: userTrust.tierOverride,
      tierOverrideUntil: userTrust.tierOverrideUntil,
    })
    .from(userTrust)
    .innerJoin(users, eq(users.id, userTrust.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, userTrust.userId))
    .where(eq(userTrust.userId, userId))
    .get();

  if (!state) return null;

  const events = await db
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.userId, userId))
    .orderBy(desc(trustEvents.occurredAt))
    .all();

  const reversed = new Set(
    events.flatMap((e) => (e.reversesEventId ? [e.reversesEventId] : [])),
  );
  const now = new Date();

  return {
    ...state,
    tier: resolveTier(state.score, state, now),
    toNextTier: distanceToNextTier(state.score),
    events: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      delta: event.delta,
      effective: reversed.has(event.id) ? 0 : effectiveDelta(event, now),
      reversed: reversed.has(event.id),
      reversesEventId: event.reversesEventId,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      reason: event.reason,
      actorEmail: event.actorEmail,
      occurredAt: event.occurredAt,
    })),
  };
}

/** 一覧に出すユーザの表示名をまとめて引く。他画面から信頼値を出すとき用 */
export async function getTrustTiers(userIds: readonly string[]): Promise<Map<string, TrustTier>> {
  if (userIds.length === 0) return new Map();

  const db = await getDatabase();
  const rows = await db
    .select({
      userId: userTrust.userId,
      score: userTrust.score,
      tierOverride: userTrust.tierOverride,
      tierOverrideUntil: userTrust.tierOverrideUntil,
    })
    .from(userTrust)
    .where(inArray(userTrust.userId, [...userIds]))
    .all();

  const now = new Date();
  return new Map(rows.map((row) => [row.userId, resolveTier(row.score, row, now)]));
}
