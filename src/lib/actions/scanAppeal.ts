"use server";

import { getAuthenticatedDb, getAdminDb, assertProjectAccess } from "@/lib/auth-helpers";
import { scanAppeals, versions } from "@/db/schema";
import { findProjectPostById } from "@/lib/queries/post";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { notifyAppealResult, notifyScanStatusChanged } from "@/lib/actions/scanAppealNotify";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const REASON_MAX_LENGTH = 2000;

/**
 * スキャン判定への異議を作者が申請する。
 *
 * suspicious / malicious 判定のバージョンにのみ申請でき、
 * 同一バージョンに保留中の申請が既にある場合は重複を許さない。
 */
export async function createScanAppeal(versionId: string, formData: FormData) {
  const { db, userId, session } = await getAuthenticatedDb();

  const reason = (formData.get("reason") as string | null)?.trim();
  if (!reason) return { error: "reasonRequired" };

  const version = await db.select().from(versions).where(eq(versions.id, versionId)).get();
  if (!version) return { error: "notFound" };

  const project = await findProjectPostById(db, version.projectId);
  if (!project) return { error: "notFound" };
  await assertProjectAccess(db, project, session);

  if (version.scanStatus !== "suspicious" && version.scanStatus !== "malicious") {
    return { error: "notAppealable" };
  }

  const existing = await db
    .select({ id: scanAppeals.id })
    .from(scanAppeals)
    .where(and(eq(scanAppeals.versionId, versionId), eq(scanAppeals.status, "pending")))
    .get();
  if (existing) return { error: "alreadyPending" };

  await db.insert(scanAppeals).values({
    id: createId(),
    reason: reason.slice(0, REASON_MAX_LENGTH),
    versionId,
    appellantId: userId,
  }).run();

  revalidatePath(`/projects/${project.slug}/versions/${versionId}`);
  return { success: true };
}

/**
 * 管理者が異議を裁定する。
 *
 * 承認時はバージョンのスキャン状態を clean に上書きし、DL遮断を解除する。
 * 却下時はスキャン状態を変えず、判定を維持する。
 */
export async function reviewScanAppeal(
  appealId: string,
  decision: "approved" | "rejected",
  reviewNote?: string
) {
  const { db, userId } = await getAdminDb();

  const appeal = await db.select().from(scanAppeals).where(eq(scanAppeals.id, appealId)).get();
  if (!appeal) return { error: "notFound" };
  if (appeal.status !== "pending") return { error: "alreadyReviewed" };

  const note = reviewNote?.trim() || null;

  await db.update(scanAppeals).set({
    status: decision,
    reviewNote: note,
    reviewedById: userId,
    reviewedAt: new Date(),
  }).where(eq(scanAppeals.id, appealId)).run();

  if (decision === "approved") {
    await db.update(versions)
      .set({ scanStatus: "clean" })
      .where(eq(versions.id, appeal.versionId))
      .run();

    // 誤検知だったので、確定検知で積んだ減点も取り消す
    const { applyScanCleared } = await import("@/lib/services/trustModeration");
    await applyScanCleared(appeal.versionId, "scan appeal approved");
  }

  await notifyAppealResult(db, appeal.versionId, appeal.appellantId, decision, note);

  await recordModerationAudit(
    db,
    decision === "approved" ? "scan_appeal_approve" : "scan_appeal_reject",
    appeal.versionId,
    userId,
    { appealId }
  );

  revalidatePath("/admin/appeals");
  return { success: true };
}

/** 管理者が直接付け替えられる判定。pending / skipped へは戻せない */
export type ScanOverrideStatus = "clean" | "suspicious" | "malicious";

/**
 * 保留中の異議があれば、この上書きと同じ裁定で閉じる。
 * clean 化は申請が通ったのと同義なので approved、それ以外は rejected として決着させる。
 * 作者側に宙吊りの申請を残さないための処理。
 */
async function closePendingAppeal(
  db: Awaited<ReturnType<typeof getAdminDb>>["db"],
  versionId: string,
  status: ScanOverrideStatus,
  reviewNote: string | null,
  reviewerId: string,
): Promise<string | null> {
  const pending = await db
    .select({ id: scanAppeals.id, appellantId: scanAppeals.appellantId })
    .from(scanAppeals)
    .where(and(eq(scanAppeals.versionId, versionId), eq(scanAppeals.status, "pending")))
    .get();
  if (!pending) return null;

  const decision = status === "clean" ? "approved" : "rejected";
  await db.update(scanAppeals).set({
    status: decision,
    reviewNote,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
  }).where(eq(scanAppeals.id, pending.id)).run();

  await notifyAppealResult(db, versionId, pending.appellantId, decision, reviewNote);
  return pending.id;
}

/**
 * 異議申請を経ずに管理者がスキャン判定を上書きする。
 *
 * 誤検知に気づくのは作者だけとは限らず、申請が無いまま止まり続けるのを避けるため、
 * 管理画面のスキャンログから直接承認（clean 化）・再遮断できるようにしている。
 */
export async function overrideScanStatus(
  versionId: string,
  status: ScanOverrideStatus,
  note?: string
) {
  const { db, userId } = await getAdminDb();

  const version = await db
    .select({ id: versions.id, scanStatus: versions.scanStatus })
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();
  if (!version) return { error: "notFound" };
  if (version.scanStatus === status) return { error: "noChange" };

  const reviewNote = note?.trim().slice(0, REASON_MAX_LENGTH) || null;

  await db.update(versions).set({ scanStatus: status }).where(eq(versions.id, versionId)).run();

  const trust = await import("@/lib/services/trustModeration");
  if (status === "malicious") {
    await trust.applyScanMalicious(versionId, reviewNote ?? "manual override");
  } else if (version.scanStatus === "malicious") {
    await trust.applyScanCleared(versionId, reviewNote ?? "manual override");
  }

  const closedAppealId = await closePendingAppeal(db, versionId, status, reviewNote, userId);

  await recordModerationAudit(db, "scan_override", versionId, userId, {
    from: version.scanStatus,
    to: status,
    note: reviewNote,
    closedAppealId,
  });

  // 手動判定で異常ステータスになった場合は作者に通知
  if (status === "suspicious" || status === "malicious") {
    await notifyScanStatusChanged(db, versionId, status);
  }

  revalidatePath("/admin/scans");
  revalidatePath("/admin/appeals");
  return { success: true };
}
