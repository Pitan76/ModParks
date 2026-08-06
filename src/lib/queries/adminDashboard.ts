import { count, eq } from "drizzle-orm";
import { getAdminDb } from "@/lib/auth-helpers";
import { reports, scanAppeals } from "@/db/schema/moderation";
import { users } from "@/db/schema/auth";
import { projects } from "@/db/schema/projects";

export interface AdminStats {
  pendingReports: number;
  pendingAppeals: number;
  totalUsers: number;
  totalProjects: number;
}

/**
 * 管理画面用の基本統計情報を取得します。
 */
export async function getAdminStats(): Promise<AdminStats> {
  const { db } = await getAdminDb();

  const [reportsRes, appealsRes, usersRes, projectsRes] = await Promise.all([
    db.select({ value: count() }).from(reports).where(eq(reports.status, "pending")),
    db.select({ value: count() }).from(scanAppeals).where(eq(scanAppeals.status, "pending")),
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(projects),
  ]);

  return {
    pendingReports: reportsRes?.[0]?.value ?? 0,
    pendingAppeals: appealsRes?.[0]?.value ?? 0,
    totalUsers: usersRes?.[0]?.value ?? 0,
    totalProjects: projectsRes?.[0]?.value ?? 0,
  };
}
