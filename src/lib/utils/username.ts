import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/** username に使用可能な文字は [a-zA-Z0-9_-] のみ（settings.ts の変更バリデーションと一致） */
function sanitizeBase(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 20);
  // 空や短すぎる場合はプレフィックスで補う
  return cleaned.length >= 3 ? cleaned : `user${cleaned}`;
}

/**
 * メール・表示名から人間可読で一意な username を生成する。
 * OAuth/マジックリンクの新規ユーザーが UUID のままにならないようにする。
 * @param db drizzle DB インスタンス
 * @param hints username の元になる候補（email のローカル部・表示名など）
 * @returns 既存と衝突しない username
 */
export async function generateUniqueUsername(
  db: any,
  hints: { email?: string | null; name?: string | null }
): Promise<string> {
  const source =
    hints.email?.split("@")[0] || hints.name || "user";
  const base = sanitizeBase(source);

  // まず素の候補、衝突したら短いランダムサフィックスを付与して再試行
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await db
      .select({ id: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.username, candidate))
      .get();
    if (!existing) return candidate;
  }

  // 万一すべて衝突した場合の最終フォールバック（実質衝突しない）
  return `${base}-${Date.now().toString(36)}`;
}
