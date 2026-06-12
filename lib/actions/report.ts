"use server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reports, projects } from "@/db/schema";
import { createReportSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function getD1(): D1Database {
  // @ts-expect-error Cloudflare Workers env binding
  const db = (process.env as unknown as { DB: D1Database }).DB;
  if (!db) throw new Error("D1 binding not found");
  return db;
}

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

  const db = getDb(getD1());
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

  const db = getDb(getD1());

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

  const db = getDb(getD1());

  await db
    .update(projects)
    .set({ status: "draft" })
    .where(eq(projects.id, projectId))
    .run();

  revalidatePath("/admin/reports");
  revalidatePath("/projects");
  return { success: true };
}
