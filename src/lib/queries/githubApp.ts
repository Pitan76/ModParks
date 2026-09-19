/** GitHub App のインストール状況を読むクエリ */
import { githubInstallations } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { eq } from "drizzle-orm";

/**
 * ユーザーが GitHub App をインストールしているアカウント名の一覧。
 * 未インストールなら空配列。設定画面の状態表示に使う。
 */
export async function listGithubAppAccounts(db: Database, userId: string): Promise<string[]> {
  try {
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
