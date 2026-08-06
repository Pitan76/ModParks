"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/auth-helpers";
import { userTrust, TRUST_TIERS, type TrustTier } from "@/db/schema";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { recomputeTrust, recordTrustEvent, reverseTrustEvent } from "@/lib/services/trust";

const REASON_MAX_LENGTH = 500;

type ActionResult = { success: true } | { error: string };

/** 管理操作は理由を必須にする。後から「なぜこうしたか」を追えない台帳は運用されない */
function normalizeReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, REASON_MAX_LENGTH);
}

function revalidateTrust(userId: string) {
  revalidatePath("/admin/trust");
  revalidatePath(`/admin/trust/${userId}`);
}

/**
 * スコアを手で動かす。
 *
 * user_trust.score を直接書き換えず、台帳へ manual_grant / manual_penalty を積む。
 * 何度でも行える操作なので、冪等キーには操作ごとの一意な値を入れる。
 */
export async function adjustTrustScore(
  userId: string,
  delta: number,
  reason: string
): Promise<ActionResult> {
  const { db, session, userId: adminId } = await getAdminDb();

  if (!Number.isInteger(delta) || delta === 0) return { error: "invalidDelta" };

  const normalized = normalizeReason(reason);
  if (!normalized) return { error: "reasonRequired" };

  await recordTrustEvent({
    userId,
    kind: delta > 0 ? "manual_grant" : "manual_penalty",
    delta,
    subjectType: "user",
    subjectId: crypto.randomUUID(),
    reason: normalized,
    actorEmail: session.user?.email ?? undefined,
  });

  await recordModerationAudit(db, "trust_adjust", userId, adminId, { delta, reason: normalized });
  revalidateTrust(userId);
  return { success: true };
}

/**
 * 段階をスコアと切り離して直接指定する。
 *
 * 便利すぎて常用されると信頼値が形骸化するため、
 * 適用中であることは一覧・詳細の双方に必ず表示する（→ memo/TRUST_CREDIT.md 6.2）。
 */
export async function setTrustTierOverride(
  userId: string,
  tier: TrustTier | null,
  reason: string,
  until?: Date | null
): Promise<ActionResult> {
  const { db, userId: adminId } = await getAdminDb();

  if (tier !== null && !TRUST_TIERS.includes(tier)) return { error: "invalidTier" };

  const normalized = normalizeReason(reason);
  if (!normalized) return { error: "reasonRequired" };

  await db
    .update(userTrust)
    .set({ tierOverride: tier, tierOverrideUntil: tier ? until ?? null : null })
    .where(eq(userTrust.userId, userId))
    .run();

  await recordModerationAudit(db, "trust_tier_override", userId, adminId, {
    tier,
    until: until?.toISOString() ?? null,
    reason: normalized,
  });
  revalidateTrust(userId);
  return { success: true };
}

/** 調査中の自動加点を止める。減点は止めない（→ 4 章） */
export async function setTrustFrozen(
  userId: string,
  frozen: boolean,
  reason: string
): Promise<ActionResult> {
  const { db, userId: adminId } = await getAdminDb();

  const normalized = normalizeReason(reason);
  if (!normalized) return { error: "reasonRequired" };

  await db.update(userTrust).set({ frozen }).where(eq(userTrust.userId, userId)).run();
  // 凍結の切り替えは加点の扱いを変えるため、スコアを作り直す
  await recomputeTrust(userId);

  await recordModerationAudit(db, "trust_freeze", userId, adminId, { frozen, reason: normalized });
  revalidateTrust(userId);
  return { success: true };
}

/**
 * 台帳の 1 行を却下する。誤判定の取り消しはすべてここを通る。
 * 行は消さず、打ち消しイベントを積むことで無効化する。
 */
export async function reverseTrustEventAction(
  userId: string,
  eventId: string,
  reason: string
): Promise<ActionResult> {
  const { db, session, userId: adminId } = await getAdminDb();

  const normalized = normalizeReason(reason);
  if (!normalized) return { error: "reasonRequired" };

  const reversed = await reverseTrustEvent(eventId, normalized, session.user?.email ?? "admin");
  if (!reversed) return { error: "notReversible" };

  await recordModerationAudit(db, "trust_event_reverse", userId, adminId, {
    eventId,
    reason: normalized,
  });
  revalidateTrust(userId);
  return { success: true };
}

/** 係数や閾値を変えた後に、そのユーザのキャッシュを作り直す */
export async function recomputeTrustAction(userId: string): Promise<ActionResult> {
  const { db, userId: adminId } = await getAdminDb();

  await recomputeTrust(userId);
  await recordModerationAudit(db, "trust_recompute", userId, adminId);
  revalidateTrust(userId);
  return { success: true };
}
