/**
 * 信頼ポイントの導入時に 1 度だけ行う遡及投入。
 *
 * 制度を後から入れる以上、**導入時点の現役ユーザが「今までできたこと」を
 * 失ってはならない**。初期値 50 から始めると既存ユーザは `new` に留まるため、
 * 過去の実績と在籍年数を台帳へ積み直したうえで、移行時に限り下限を置く。
 *
 * 記録は冪等なので複数回流しても二重には積まれないが、
 * 3 の下限補填だけは 1 度きりの操作として扱う（→ applyMigrationFloor）。
 */
import { and, isNull, lt } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { users, userTrust, type User } from "@/db/schema";
import { TRUST_TIER_FLOORS } from "@/lib/trust/config";
import { syncTrustAttributes, syncAccountAge, hasSocialAccount } from "./trustAttributes";
import { syncVersionCleanCredits, listCleanVersions } from "./trustActivity";
import { groupCleanVersionsByUser, projectScore } from "./trustProjection";
import { getTrustState, recordTrustEvent, recomputeTrust } from "./trust";

/** 見積もりで走査するバージョンの上限。移行対象の規模に合わせて調整する */
const VERSION_SCAN_LIMIT = 5000;

/** 移行時にこの段階を下回るユーザは、不足分を補填して引き上げる */
const MIGRATION_FLOOR_TIER = "member" as const;

const MIGRATION_FLOOR_SCORE =
  TRUST_TIER_FLOORS.find(([tier]) => tier === MIGRATION_FLOOR_TIER)?.[1] ?? 150;

/** 補填が 1 度きりであることを担保する冪等キー */
const MIGRATION_FLOOR_SUBJECT = "trust-migration-floor";

export type TierDistribution = Record<string, number>;

export type BackfillReport = {
  dryRun: boolean;
  /** 遡及対象となった既存ユーザ数 */
  users: number;
  /** 新たに積んだ version_clean の件数 */
  versionCredits: number;
  /** 下限補填を受けたユーザ数 */
  floored: number;
  distribution: TierDistribution;
  /** dry-run のみ。補填を適用する前の分布。係数の妥当性はこちらで判断する */
  distributionBeforeFloor?: TierDistribution;
};

/** 導入前から存在するユーザ。移行の対象はこれだけ */
async function findExistingUsers(cutoff: Date, limit: number): Promise<User[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(users)
    .where(and(
      isNull(users.deletedAt),
      isNull(users.suspendedAt),
      lt(users.createdAt, cutoff),
    ))
    .limit(limit)
    .all();
}

/**
 * 移行時に限り、下限を `member` に引き上げる。
 *
 * スコアを直接書き換えず `manual_grant` で不足分を積むので、
 * 「制度導入時に特別扱いした」事実が台帳に残る。
 */
async function applyMigrationFloor(user: User): Promise<boolean> {
  const { score } = await getTrustState(user.id);
  if (score >= MIGRATION_FLOOR_SCORE) return false;

  return recordTrustEvent({
    userId: user.id,
    kind: "manual_grant",
    delta: MIGRATION_FLOOR_SCORE - score,
    subjectType: "user",
    subjectId: MIGRATION_FLOOR_SUBJECT,
    reason: "trust credit migration floor",
    occurredAt: new Date(),
  });
}

/** 段階ごとの人数。係数が妥当かはこの分布を見て判断する */
export async function getTierDistribution(): Promise<TierDistribution> {
  const db = await getDatabase();
  const rows = await db.select({ tier: userTrust.tier }).from(userTrust).all();

  const distribution: TierDistribution = {};
  for (const [tier] of TRUST_TIER_FLOORS) distribution[tier] = 0;
  for (const row of rows) distribution[row.tier] = (distribution[row.tier] ?? 0) + 1;
  return distribution;
}

/**
 * 遡及投入を実行する。
 *
 * **dryRun が既定。**本実行の前に必ず分布を出し、目視で確認する。
 * 係数がおかしいまま流すと、全員が同じ段階に張り付いた台帳が出来上がる。
 */
export async function backfillTrust(options: {
  dryRun?: boolean;
  cutoff?: Date;
  limit?: number;
} = {}): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? true;
  const cutoff = options.cutoff ?? new Date();
  const targets = await findExistingUsers(cutoff, options.limit ?? 1000);

  if (dryRun) {
    const simulated = await simulate(targets, cutoff);
    return {
      dryRun: true,
      users: targets.length,
      versionCredits: simulated.versionCredits,
      floored: simulated.floored,
      distribution: simulated.withFloor,
      distributionBeforeFloor: simulated.raw,
    };
  }

  const versionCredits = await syncVersionCleanCredits();

  const now = new Date();
  let floored = 0;
  for (const user of targets) {
    await syncTrustAttributes(user);
    await syncAccountAge(user, now);
    if (await applyMigrationFloor(user)) floored += 1;
  }

  return {
    dryRun: false,
    users: targets.length,
    versionCredits,
    floored,
    distribution: await getTierDistribution(),
  };
}

/**
 * 何も書かずに、投入後の段階分布を見積もる。
 *
 * **下限補填を適用する前の分布も返す。**補填で全員 `member` に揃った表を見ても
 * 係数が妥当かは判断できず、dry-run の意味がなくなるため。
 */
async function simulate(targets: readonly User[], now: Date): Promise<SimulationResult> {
  const grouped = groupCleanVersionsByUser(await listCleanVersions(now, VERSION_SCAN_LIMIT));

  const raw = emptyDistribution();
  const withFloor = emptyDistribution();
  let floored = 0;

  for (const user of targets) {
    const score = projectScore({
      user,
      hasSocial: await hasSocialAccount(user.id),
      cleanVersions: grouped.get(user.id) ?? [],
    }, now);

    raw[tierOf(score)] += 1;
    if (score < MIGRATION_FLOOR_SCORE) floored += 1;
    withFloor[tierOf(Math.max(score, MIGRATION_FLOOR_SCORE))] += 1;
  }

  return { raw, withFloor, floored, versionCredits: grouped.size };
}

type SimulationResult = {
  raw: TierDistribution;
  withFloor: TierDistribution;
  floored: number;
  versionCredits: number;
};

function emptyDistribution(): TierDistribution {
  const distribution: TierDistribution = {};
  for (const [tier] of TRUST_TIER_FLOORS) distribution[tier] = 0;
  return distribution;
}

function tierOf(score: number): string {
  return TRUST_TIER_FLOORS.find(([, floor]) => score >= floor)?.[0] ?? "restricted";
}

/** 移行後にキャッシュを作り直す。係数を変えた場合もこれを回す */
export async function recomputeAll(limit = 1000): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select({ userId: users.id }).from(users).limit(limit).all();

  for (const row of rows) await recomputeTrust(row.userId);
  return rows.length;
}
