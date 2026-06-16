"use server";

import { getAuthenticatedDb, getAdminDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { reports, projects, users, userProfiles } from "@/db/schema";
import { createReportSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * ユーザーがプロジェクトを通報する Server Action
 * @param projectId 通報対象のプロジェクトID
 * @param formData フォームデータ (reason, detail)
 * @returns { success: boolean } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 */
export async function createReport(projectId: string, formData: FormData) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    reason: formData.get("reason"),
    detail: formData.get("detail"),
  };

  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const id = createId();

  await db.insert(reports).values({
    id,
    reason:     parsed.data.reason,
    detail:     parsed.data.detail || null,
    reporterId: userId,
    projectId,
  }).run();

  return { success: true };
}

// ─── 管理者: 通報ステータス更新 ───────────────────────────────────────────────

/**
 * 管理者が通報のステータスを更新する Server Action
 * @param reportId 対象の通報ID
 * @param status 変更後のステータス ("resolved" または "dismissed")
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function updateReportStatus(
  reportId: string,
  status: "resolved" | "dismissed",
  formData?: FormData
) {
  const { db } = await getAdminDb();

  await db
    .update(reports)
    .set({ status })
    .where(eq(reports.id, reportId))
    .run();

  revalidatePath("/admin/reports");
  return { success: true };
}

// ─── 管理者: プロジェクト非公開 ──────────────────────────────────────────────

/**
 * 管理者が問題のあるプロジェクトを非公開(draft)にする Server Action
 * @param projectId 対象のプロジェクトID
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function unpublishProject(projectId: string, formData?: FormData) {
  const { db } = await getAdminDb();

  await db
    .update(projects)
    .set({ status: "draft" })
    .where(eq(projects.id, projectId))
    .run();

  revalidatePath("/admin/reports");
  revalidatePath("/projects");
  return { success: true };
}

// ─── 管理者: 通報一覧取得 ───────────────────────────────────────────────────

/**
 * 管理者向け: すべての通報一覧を取得する Server Action
 * @returns 通報データ(report)と、対象プロジェクト(project)、通報者(reporter)の結合配列
 * @throws Forbidden 管理者権限がない場合
 */
export async function getReports() {
  const { db } = await getAdminDb();

  return await db
    .select({
      report: reports,
      project: {
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
      },
      reporter: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
      }
    })
    .from(reports)
    .innerJoin(projects, eq(reports.projectId, projects.id))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .orderBy(desc(reports.createdAt))
    .all();
}
