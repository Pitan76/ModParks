"use server";

import { getDatabase } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";

export async function registerUser(formData: FormData) {
  const username    = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;
  const email       = formData.get("email") as string;
  const password    = formData.get("password") as string;
  
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("register", 10, 5 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  if (!username || !displayName || !email || !password) {
    return { error: "allFieldsRequired" };
  }

  if (password.length < 8) {
    return { error: "passwordLength" };
  }

  const db = await getDatabase();

  // 重複チェック
  const existingUser = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .get();

  if (existingUser) {
    if (existingUser.email === email) {
      return { error: "emailTaken" };
    }
    if (existingUser.username === username) {
      return { error: "usernameTaken" };
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = createId();

  await db.insert(users).values({
    id,
    username,
    displayName,
    name: displayName,
    email,
    passwordHash,
    role: "user",
  }).run();

  return { success: true };
}
