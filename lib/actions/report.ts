"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { reports, projects, users } from "@/db/schema";
import { createReportSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * ユーザーがプロジェクトを通報する Server Action
 * @param projectId 通報対象のプロジェクトID
 * @param formData フォームデータ (reason, detail)
 * @returns { success: boolean } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 */
export async function createReport(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const raw = {
    reason: formData.get("reason"),
    detail: formData.get("detail"),
  };

  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const d1 = await getD1();
  const db = getDb(d1);
  const id = createId();

  await db.insert(reports).values({
    id,
    reason:     parsed.data.reason,
    detail:     parsed.data.detail || null,
    reporterId: session.user.id,
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
  status: "resolved" | "dismissed"
) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");

  const d1 = await getD1();
  const db = getDb(d1);

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
export async function unpublishProject(projectId: string) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");

  const d1 = await getD1();
  const db = getDb(d1);

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
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");

  const d1 = await getD1();
  const db = getDb(d1);

  const rows = await db
    .select({
      report: reports,
      project: {
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
      },
      reporter: {
        username: users.username,
        displayName: users.displayName,
      }
    })
    .from(reports)
    .innerJoin(projects, eq(reports.projectId, projects.id))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .orderBy(reports.createdAt)
    .all();

  // 最新が上に来るように新しい順にしたい場合は orderBy(desc(reports.createdAt)) が良いが、未対応を優先したい場合は保留中を先に。
  // 今回は一旦そのまま新しい順にします。
  return rows.sort((a, b) => new Date(b.report.createdAt).getTime() - new Date(a.report.createdAt).getTime());
}
