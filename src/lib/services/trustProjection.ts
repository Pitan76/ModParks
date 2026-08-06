/**
 * 遡及投入を実行したら各ユーザのスコアがいくつになるかを、**何も書かずに**見積もる。
 *
 * 台帳へ積むはずのイベントをメモリ上で組み立て、
 * 本番と同じ computeScore に通す。dry-run の結果が本実行とずれないようにするため、
 * 判定ロジックはここに複製せず必ず score.ts を経由させる。
 */
import type { TrustEvent, TrustEventKind, User } from "@/db/schema";
import { computeScore } from "@/lib/trust/score";
import {
  TRUST_ACCOUNT_AGE_STEPS,
  TRUST_DORMANT_DAYS,
  TRUST_EVENT_DELTAS,
  TRUST_NON_DECAYING_KINDS,
} from "@/lib/trust/config";
import type { CleanVersion } from "./trustActivity";

const DAY_MS = 86_400_000;

/** computeScore に渡すためだけの、DB に存在しないイベント */
function syntheticEvent(
  userId: string,
  kind: TrustEventKind,
  occurredAt: Date,
  delta = TRUST_EVENT_DELTAS[kind] ?? 0,
): TrustEvent {
  return {
    id: `${userId}:${kind}:${occurredAt.getTime()}`,
    userId,
    kind,
    delta,
    decays: delta > 0 && !TRUST_NON_DECAYING_KINDS.has(kind),
    subjectType: "none",
    subjectId: "",
    reversesEventId: null,
    reason: null,
    actorEmail: null,
    occurredAt,
    createdAt: occurredAt,
  };
}

function isDormant(user: User, now: Date): boolean {
  const lastSeen = user.lastLoginAt ?? user.createdAt;
  return now.getTime() - lastSeen.getTime() > TRUST_DORMANT_DAYS * DAY_MS;
}

/** 属性由来の加点。ソーシャル連携の有無は呼び出し側が判定して渡す */
function attributeEvents(user: User, hasSocial: boolean, now: Date): TrustEvent[] {
  const events: TrustEvent[] = [];
  if (user.emailVerified) events.push(syntheticEvent(user.id, "email_verified", now));
  if (user.twoFactorEnabled) events.push(syntheticEvent(user.id, "two_factor_enabled", now));
  if (hasSocial) events.push(syntheticEvent(user.id, "social_linked", now));
  return events;
}

/** 在籍年数の加点。occurredAt は到達日なので、減衰の起点が本実行と一致する */
function accountAgeEvents(user: User, now: Date): TrustEvent[] {
  if (isDormant(user, now)) return [];

  const ageDays = (now.getTime() - user.createdAt.getTime()) / DAY_MS;
  const events: TrustEvent[] = [];

  for (const [kind, requiredDays] of TRUST_ACCOUNT_AGE_STEPS) {
    if (ageDays < requiredDays) break;
    events.push(
      syntheticEvent(user.id, kind, new Date(user.createdAt.getTime() + requiredDays * DAY_MS)),
    );
  }
  return events;
}

export type ProjectionInput = {
  user: User;
  hasSocial: boolean;
  /** そのユーザが実行者になっているクリーンなバージョン */
  cleanVersions: readonly CleanVersion[];
};

/** 遡及投入後に想定されるスコア */
export function projectScore(input: ProjectionInput, now: Date = new Date()): number {
  const { user } = input;

  const versionEvents = input.cleanVersions.map((version) =>
    syntheticEvent(user.id, "version_clean", version.publishedAt),
  );

  return computeScore(
    [...attributeEvents(user, input.hasSocial, now), ...accountAgeEvents(user, now), ...versionEvents],
    { now },
  );
}

/** クリーンなバージョンを、加点先のユーザごとにまとめる */
export function groupCleanVersionsByUser(
  versions: readonly CleanVersion[],
): Map<string, CleanVersion[]> {
  const grouped = new Map<string, CleanVersion[]>();

  for (const version of versions) {
    const userId = version.uploaderId ?? version.authorId;
    const list = grouped.get(userId);
    if (list) {
      list.push(version);
      continue;
    }
    grouped.set(userId, [version]);
  }
  return grouped;
}
