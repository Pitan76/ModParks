"use server";

import { getAuthenticatedDb, getAdminDb, assertProjectAccess } from "@/lib/auth-helpers";
import { scanAppeals, versions, projects, userProfiles, users } from "@/db/schema";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc, and } from "drizzle-orm";
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

  const project = await db.select().from(projects).where(eq(projects.id, version.projectId)).get();
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

  await db.update(scanAppeals).set({
    status: decision,
    reviewNote: reviewNote?.trim() || null,
    reviewedById: userId,
    reviewedAt: new Date(),
  }).where(eq(scanAppeals.id, appealId)).run();

  if (decision === "approved") {
    await db.update(versions)
      .set({ scanStatus: "clean" })
      .where(eq(versions.id, appeal.versionId))
      .run();
  }

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

/** 管理者向け: 保留中の異議申請を対象バージョン・申請者と結合して取得する */
export async function getScanAppeals(status: "pending" | "approved" | "rejected" = "pending") {
  const { db } = await getAdminDb();

  return await db
    .select({
      appeal: scanAppeals,
      version: {
        id: versions.id,
        versionNumber: versions.versionNumber,
        scanStatus: versions.scanStatus,
        scanFindings: versions.scanFindings,
      },
      project: {
        slug: projects.slug,
        name: projects.name,
      },
      appellant: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
      },
    })
    .from(scanAppeals)
    .innerJoin(versions, eq(scanAppeals.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .innerJoin(users, eq(scanAppeals.appellantId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(scanAppeals.status, status))
    .orderBy(desc(scanAppeals.createdAt))
    .all();
}
