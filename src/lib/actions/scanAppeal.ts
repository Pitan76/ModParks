"use server";

import { getAuthenticatedDb, getAdminDb, assertProjectAccess } from "@/lib/auth-helpers";
import { scanAppeals, versions, posts, projects, userProfiles, users } from "@/db/schema";
import { findProjectPostById } from "@/lib/queries/post";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc, and, count } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
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

    // 誤検知だったので、確定検知で積んだ減点も取り消す
    const { applyScanCleared } = await import("@/lib/services/trustModeration");
    await applyScanCleared(appeal.versionId, "scan appeal approved");
  }

  // 裁定通知の送信
  try {
    const project = await db
      .select({
        projectName: posts.title,
        projectSlug: posts.slug,
        iconUrl: projects.iconUrl,
        versionNumber: versions.versionNumber,
      })
      .from(versions)
      .innerJoin(projects, eq(versions.projectId, projects.id))
      .innerJoin(posts, eq(posts.id, projects.id))
      .where(eq(versions.id, appeal.versionId))
      .get();

    if (project) {
      const statusLabel = decision === "approved" ? "承認 (approved)" : "却下 (rejected)";
      const { notifyToUser } = await import("@/lib/notifications/notify");
      await notifyToUser(db, appeal.appellantId, "system", "scan_appeal_result", {
        projectName: project.projectName,
        slug: project.projectSlug,
        versionNumber: project.versionNumber,
        versionId: appeal.versionId,
        statusLabel,
        reviewNote: reviewNote?.trim() || "なし",
        iconUrl: project.iconUrl || "",
      });
    }
  } catch (err) {
    console.error("Failed to send appeal review notification:", err);
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

/** 管理者が直接付け替えられる判定。pending / skipped へは戻せない */
export type ScanOverrideStatus = "clean" | "suspicious" | "malicious";

/**
 * 異議申請を経ずに管理者がスキャン判定を上書きする。
 *
 * 誤検知に気づくのは作者だけとは限らず、申請が無いまま止まり続けるのを避けるため、
 * 管理画面のスキャンログから直接承認（clean 化）・再遮断できるようにしている。
 * 保留中の異議があれば、この裁定でそのまま決着させる（作者側に宙吊りの申請を残さない）。
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

  // 保留中の異議は同じ裁定で閉じる。clean 化なら申請が通ったのと同義
  const pending = await db
    .select({ id: scanAppeals.id, appellantId: scanAppeals.appellantId })
    .from(scanAppeals)
    .where(and(eq(scanAppeals.versionId, versionId), eq(scanAppeals.status, "pending")))
    .get();

  if (pending) {
    const decision = status === "clean" ? "approved" : "rejected";
    await db.update(scanAppeals).set({
      status: decision,
      reviewNote,
      reviewedById: userId,
      reviewedAt: new Date(),
    }).where(eq(scanAppeals.id, pending.id)).run();

    // 裁定通知の送信
    try {
      const project = await db
        .select({
          projectName: posts.title,
          projectSlug: posts.slug,
          iconUrl: projects.iconUrl,
          versionNumber: versions.versionNumber,
        })
        .from(versions)
        .innerJoin(projects, eq(versions.projectId, projects.id))
        .innerJoin(posts, eq(posts.id, projects.id))
        .where(eq(versions.id, versionId))
        .get();

      if (project) {
        const statusLabel = decision === "approved" ? "承認 (approved)" : "却下 (rejected)";
        const { notifyToUser } = await import("@/lib/notifications/notify");
        await notifyToUser(db, pending.appellantId, "system", "scan_appeal_result", {
          projectName: project.projectName,
          slug: project.projectSlug,
          versionNumber: project.versionNumber,
          versionId: versionId,
          statusLabel,
          reviewNote: reviewNote || "なし",
          iconUrl: project.iconUrl || "",
        });
      }
    } catch (err) {
      console.error("Failed to send override appeal notification:", err);
    }
  }

  await recordModerationAudit(db, "scan_override", versionId, userId, {
    from: version.scanStatus,
    to: status,
    note: reviewNote,
    closedAppealId: pending?.id ?? null,
  });

  // 手動判定で異常ステータス（suspicious/malicious）になった場合は作者に通知
  if (status === "suspicious" || status === "malicious") {
    try {
      const project = await db
        .select({
          authorId: posts.authorId,
          projectName: posts.title,
          projectSlug: posts.slug,
          iconUrl: projects.iconUrl,
          versionNumber: versions.versionNumber,
        })
        .from(versions)
        .innerJoin(projects, eq(versions.projectId, projects.id))
        .innerJoin(posts, eq(posts.id, projects.id))
        .where(eq(versions.id, versionId))
        .get();

      if (project) {
        const statusLabel = status === "malicious" ? "悪質 (malicious)" : status === "suspicious" ? "疑わしい (suspicious)" : "スキャン失敗 (failed)";
        const { notifyToUser } = await import("@/lib/notifications/notify");
        await notifyToUser(db, project.authorId, "system", "scan_result", {
          projectName: project.projectName,
          slug: project.projectSlug,
          versionNumber: project.versionNumber,
          versionId: versionId,
          statusLabel,
          iconUrl: project.iconUrl || "",
        });
      }
    } catch (err) {
      console.error("Failed to send scan override notice:", err);
    }
  }

  revalidatePath("/admin/scans");
  revalidatePath("/admin/appeals");
  return { success: true };
}

export async function getLatestScanAppeal(versionId: string) {
  const { getDatabase } = await import("@/lib/db");
  const { scanAppeals } = await import("@/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const db = await getDatabase();
  return db
    .select({
      status: scanAppeals.status,
      reviewNote: scanAppeals.reviewNote,
    })
    .from(scanAppeals)
    .where(eq(scanAppeals.versionId, versionId))
    .orderBy(desc(scanAppeals.createdAt))
    .limit(1)
    .get();
}

/** 一覧のフィルタ。"all" は裁定済みも含めた全件 */
export type ScanAppealFilter = "pending" | "approved" | "rejected" | "all";

/**
 * 管理者向け: 異議申請を対象バージョン・申請者・裁定者と結合して取得する。
 * 裁定済みも遡って確認できるよう、status には "all" を渡せる。
 */
export async function getScanAppeals(status: ScanAppealFilter = "pending") {
  const { db } = await getAdminDb();

  // 申請者と裁定者で users を2回結合するため、裁定者側は別名にする
  const reviewers = alias(users, "reviewers");
  const reviewerProfiles = alias(userProfiles, "reviewer_profiles");

  const query = db
    .select({
      appeal: scanAppeals,
      version: {
        id: versions.id,
        versionNumber: versions.versionNumber,
        scanStatus: versions.scanStatus,
        scanFindings: versions.scanFindings,
      },
      project: {
        slug: posts.slug,
        name: posts.title,
      },
      appellant: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
      },
      reviewer: {
        username: reviewerProfiles.username,
        displayName: reviewerProfiles.displayName,
      },
    })
    .from(scanAppeals)
    .innerJoin(versions, eq(scanAppeals.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .innerJoin(users, eq(scanAppeals.appellantId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(reviewers, eq(scanAppeals.reviewedById, reviewers.id))
    .leftJoin(reviewerProfiles, eq(reviewers.id, reviewerProfiles.userId));

  if (status === "all") return query.orderBy(desc(scanAppeals.createdAt)).all();
  return query.where(eq(scanAppeals.status, status)).orderBy(desc(scanAppeals.createdAt)).all();
}

/** ステータスごとの件数。一覧のタブに添えるバッジ用 */
export async function getScanAppealCounts() {
  const { db } = await getAdminDb();

  const rows = await db
    .select({ status: scanAppeals.status, count: count() })
    .from(scanAppeals)
    .groupBy(scanAppeals.status)
    .all();

  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) counts[row.status] = row.count;
  counts.all = counts.pending + counts.approved + counts.rejected;
  return counts;
}
