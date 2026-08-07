"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { scanAppeals, versions, posts, projects, userProfiles, users } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

/** 一覧のフィルタ。"all" は裁定済みも含めた全件 */
export type ScanAppealFilter = "pending" | "approved" | "rejected" | "all";

/** バージョン詳細に出す、直近の異議申請の状態 */
export async function getLatestScanAppeal(versionId: string) {
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
