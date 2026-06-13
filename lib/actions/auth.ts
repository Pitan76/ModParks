"use server";

import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";

export async function registerUser(formData: FormData) {
  const username    = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;
  const email       = formData.get("email") as string;
  const password    = formData.get("password") as string;

  if (!username || !displayName || !email || !password) {
    return { error: "すべての項目を入力してください。" };
  }

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }

  const d1 = await getD1();
  const db = getDb(d1);

  // 重複チェック
  const existingUser = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .get();

  if (existingUser) {
    if (existingUser.email === email) {
      return { error: "このメールアドレスは既に登録されています。" };
    }
    if (existingUser.username === username) {
      return { error: "このユーザーネームは既に使用されています。" };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
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
