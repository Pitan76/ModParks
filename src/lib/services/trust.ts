/**
 * 信頼ポイントの台帳操作。
 *
 * trust_events は追記専用で、UPDATE / DELETE しない。
 * 取り消しは reversal イベントの追加で表す。
 * user_trust は台帳から再構築できるキャッシュなので、記録と同じ batch で更新する。
 */
import { and, eq, desc, inArray, lt } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import {
  trustEvents,
  userTrust,
  TRUST_NO_SUBJECT,
  type TrustEvent,
  type TrustEventKind,
  type TrustSubjectType,
  type TrustTier,
  type UserTrust,
} from "@/db/schema";
import { TRUST_BASE_SCORE, TRUST_EVENT_DELTAS, TRUST_NON_DECAYING_KINDS } from "@/lib/trust/config";
import { computeScore, resolveTier, tierFromScore } from "@/lib/trust/score";

export type RecordTrustEventInput = {
  userId: string;
  kind: TrustEventKind;
  /** 省略時は config の既定値を使う。manual_* と malware_detected では必須 */
  delta?: number;
  subjectType?: TrustSubjectType;
  /** 同一 (userId, kind, subjectId) は 1 度しか積まれない。対象がなければ空文字 */
  subjectId?: string;
  /** 減衰の起点。省略時は現在時刻 */
  occurredAt?: Date;
  reason?: string;
  actorEmail?: string;
};

export type TrustState = {
  score: number;
  /** 上書きを適用した後の、権限判定に使う段階 */
  tier: TrustTier;
  frozen: boolean;
  overridden: boolean;
};

const DEFAULT_STATE: TrustState = {
  score: TRUST_BASE_SCORE,
  tier: tierFromScore(TRUST_BASE_SCORE),
  frozen: false,
  overridden: false,
};

/** 判定パス用。台帳を集計せず user_trust だけを読む */
export async function getTrustState(userId: string): Promise<TrustState> {
  const db = await getDatabase();
  const row = await db
    .select()
    .from(userTrust)
    .where(eq(userTrust.userId, userId))
    .get();

  if (!row) return DEFAULT_STATE;
  return toState(row);
}

function toState(row: UserTrust, now: Date = new Date()): TrustState {
  const tier = resolveTier(row.score, row, now);
  return {
    score: row.score,
    tier,
    frozen: row.frozen,
    overridden: tier !== tierFromScore(row.score),
  };
}

/** 管理画面用。減衰後の寄与は呼び出し側で effectiveDelta を使って併記する */
export async function listTrustEvents(userId: string, limit = 200): Promise<TrustEvent[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.userId, userId))
    .orderBy(desc(trustEvents.occurredAt))
    .limit(limit)
    .all();
}

function resolveDelta(input: RecordTrustEventInput): number {
  if (input.delta !== undefined) return input.delta;

  const preset = TRUST_EVENT_DELTAS[input.kind];
  if (preset === undefined) {
    throw new Error(`trust event ${input.kind} requires an explicit delta`);
  }
  return preset;
}

/** 何度でも積める種別。冪等キーが衝突しないよう、操作ごとの一意な subjectId を要求する */
const REPEATABLE_KINDS: ReadonlySet<TrustEventKind> = new Set([
  "manual_grant",
  "manual_penalty",
]);

function resolveSubjectId(input: RecordTrustEventInput): string {
  const subjectId = input.subjectId ?? TRUST_NO_SUBJECT;
  if (REPEATABLE_KINDS.has(input.kind) && subjectId === TRUST_NO_SUBJECT) {
    throw new Error(`trust event ${input.kind} requires a unique subjectId`);
  }
  return subjectId;
}

/**
 * イベントを 1 件積み、スコアを再計算する。
 *
 * 同一 (userId, kind, subjectId) が既にある場合は何もせず false を返すため、
 * バッチの再実行やリトライで二重加点にならない。
 */
export async function recordTrustEvent(input: RecordTrustEventInput): Promise<boolean> {
  const subjectId = resolveSubjectId(input);
  const db = await getDatabase();

  const existing = await db
    .select({ id: trustEvents.id })
    .from(trustEvents)
    .where(and(
      eq(trustEvents.userId, input.userId),
      eq(trustEvents.kind, input.kind),
      eq(trustEvents.subjectId, subjectId),
    ))
    .get();

  if (existing) return false;

  const delta = resolveDelta(input);
  await db.insert(trustEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    kind: input.kind,
    delta,
    decays: delta > 0 && !TRUST_NON_DECAYING_KINDS.has(input.kind),
    subjectType: input.subjectType ?? "none",
    subjectId,
    reason: input.reason ?? null,
    actorEmail: input.actorEmail ?? null,
    occurredAt: input.occurredAt ?? new Date(),
  });

  await recomputeTrust(input.userId);
  return true;
}

/**
 * マルウェア確定を記録する。
 *
 * 固定値では長く在籍した高スコアのユーザに効かないため、
 * 記録時点のスコアを 0 にする値を算出して積む。以後この値は動かさない。
 */
export async function recordMalwareDetected(
  userId: string,
  subjectId: string,
  reason: string,
): Promise<boolean> {
  const { score } = await getTrustState(userId);
  return recordTrustEvent({
    userId,
    kind: "malware_detected",
    delta: -score,
    subjectType: "version",
    subjectId,
    reason,
  });
}

/**
 * 既存イベントを打ち消す。誤判定の取り消しはすべてここを通す。
 * 元の行は消さず、打ち消した事実も履歴に残す。
 */
export async function reverseTrustEvent(
  eventId: string,
  reason: string,
  actorEmail: string,
): Promise<boolean> {
  const db = await getDatabase();
  const target = await db
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.id, eventId))
    .get();

  if (!target || target.kind === "reversal") return false;

  const already = await db
    .select({ id: trustEvents.id })
    .from(trustEvents)
    .where(eq(trustEvents.reversesEventId, eventId))
    .get();

  if (already) return false;

  await db.insert(trustEvents).values({
    id: crypto.randomUUID(),
    userId: target.userId,
    kind: "reversal",
    delta: 0,
    decays: false,
    subjectType: target.subjectType,
    subjectId: eventId,
    reversesEventId: eventId,
    reason,
    actorEmail,
    occurredAt: new Date(),
  });

  await recomputeTrust(target.userId);
  return true;
}

/** 台帳から user_trust を作り直す。係数を変えた後はこれを回す */
export async function recomputeTrust(userId: string): Promise<TrustState> {
  const db = await getDatabase();
  const [events, current] = await Promise.all([
    db.select().from(trustEvents).where(eq(trustEvents.userId, userId)).all(),
    db.select().from(userTrust).where(eq(userTrust.userId, userId)).get(),
  ]);

  const now = new Date();
  const frozen = current?.frozen ?? false;
  const score = computeScore(events, { frozen, now });
  const tier = tierFromScore(score);

  await db
    .insert(userTrust)
    .values({ userId, score, tier, computedAt: now })
    .onConflictDoUpdate({
      target: userTrust.userId,
      set: { score, tier, computedAt: now },
    });

  return toState({ ...(current ?? DEFAULT_ROW(userId)), score, tier }, now);
}

function DEFAULT_ROW(userId: string): UserTrust {
  return {
    userId,
    score: TRUST_BASE_SCORE,
    tier: tierFromScore(TRUST_BASE_SCORE),
    frozen: false,
    tierOverride: null,
    tierOverrideUntil: null,
    computedAt: new Date(),
  };
}

/**
 * 減衰があるため、イベントがなくてもスコアは動く。
 * computedAt が古い行だけを対象にし、全ユーザを舐めない。
 */
export async function recomputeStaleTrust(staleBefore: Date, limit = 500): Promise<number> {
  const db = await getDatabase();
  const stale = await db
    .select({ userId: userTrust.userId })
    .from(userTrust)
    .where(lt(userTrust.computedAt, staleBefore))
    .limit(limit)
    .all();

  for (const { userId } of stale) await recomputeTrust(userId);
  return stale.length;
}

/** 複数ユーザ分の段階をまとめて引く。一覧表示で N+1 を避けるため */
export async function getTrustStates(userIds: readonly string[]): Promise<Map<string, TrustState>> {
  if (userIds.length === 0) return new Map();

  const db = await getDatabase();
  const rows = await db
    .select()
    .from(userTrust)
    .where(inArray(userTrust.userId, [...userIds]))
    .all();

  const now = new Date();
  const states = new Map<string, TrustState>(userIds.map((id) => [id, DEFAULT_STATE]));
  for (const row of rows) states.set(row.userId, toState(row, now));
  return states;
}
