"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/auth-helpers";
import { projects, ideas } from "@/db/schema";
import { recordDeletion } from "@/lib/backup/tombstone";

/** 管理者がプロジェクトを削除する */
export async function adminDeleteProject(projectId: string) {
  const { db } = await getAdminDb();

  await db.delete(projects).where(eq(projects.id, projectId));
  await recordDeletion(db, "projects", projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  return { success: true };
}

/** 管理者がアイデアを削除する */
export async function adminDeleteIdea(ideaId: string) {
  const { db } = await getAdminDb();

  await db.delete(ideas).where(eq(ideas.id, ideaId));
  await recordDeletion(db, "ideas", ideaId);

  revalidatePath("/admin/ideas");
  revalidatePath("/ideas");
  return { success: true };
}
