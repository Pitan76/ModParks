"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateUserRole(targetUserId: string, newRole: "user" | "admin") {
  const { db, session } = await getAdminDb();

  // Prevents self-demotion to avoid locking out the only admin
  if (targetUserId === session.user.id && newRole === "user") {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) {
    throw new Error("Cannot delete yourself");
  }

  // Soft delete by setting deletedAt
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, targetUserId));
  revalidatePath("/admin/users");
  return { success: true };
}

export async function adminDeleteProject(projectId: string) {
  const { db } = await getAdminDb();
  const { projects } = await import("@/db/schema");
  
  await db.delete(projects).where(eq(projects.id, projectId));
  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  return { success: true };
}

export async function adminDeleteIdea(ideaId: string) {
  const { db } = await getAdminDb();
  const { ideas } = await import("@/db/schema");
  
  await db.delete(ideas).where(eq(ideas.id, ideaId));
  revalidatePath("/admin/ideas");
  revalidatePath("/ideas");
  return { success: true };
}
