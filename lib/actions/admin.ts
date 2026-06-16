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


