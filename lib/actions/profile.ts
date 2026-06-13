"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;
  const avatarUrl = formData.get("avatarUrl") as string;

  if (!displayName) {
    return { error: "表示名は必須です" };
  }

  const d1 = await getD1();
  const db = getDb(d1);

  await db
    .update(users)
    .set({
      displayName,
      name: displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
    })
    .where(eq(users.id, session.user.id))
    .run();

  revalidatePath("/profile");
  return { success: true };
}
