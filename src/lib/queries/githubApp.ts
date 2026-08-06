/** GitHub App のインストール状況を読むクエリ */
import { getDatabase } from "@/lib/db";
import { githubInstallations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * ユーザーが GitHub App をインストールしているアカウント名の一覧。
 * 未インストールなら空配列。設定画面の状態表示に使う。
 */
export async function listGithubAppAccounts(userId: string): Promise<string[]> {
  try {
    const db = await getDatabase();
    const rows = await db
      .select({ accountLogin: githubInstallations.accountLogin })
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .all();
    return rows.map((r: { accountLogin: string }) => r.accountLogin).filter(Boolean);
  } catch (e: unknown) {
    console.error("Failed to list GitHub App installations:", e);
    return [];
  }
}
