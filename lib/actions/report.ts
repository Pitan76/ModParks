"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { reports, projects } from "@/db/schema";
import { createReportSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
