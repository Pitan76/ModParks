/**
 * プロジェクトの連携先リポジトリを読むためのトークンを決める。
 *
 * 非公開リポジトリを読めるのは GitHub App の installation token だけだが、
 * 「App が入っているリポジトリ」＝「このユーザーが読んでよいリポジトリ」ではない。
 * インストール操作を行った本人であることを github_installations で照合してから発行する。
 */
import { githubInstallations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizeGithubRepo } from "@/lib/utils/github";
import {
  createInstallationToken,
  findInstallationIdForRepo,
  isGithubAppConfigured,
} from "@/lib/utils/githubApp";

/**
 * repo に対して userId が使えるトークンを返す。
 * App 未設定 / 未インストール / インストール者が別人の場合は undefined を返し、
 * 呼び出し側は公開リポジトリとして（サーバの GITHUB_TOKEN で）取得する。
 */
export async function getRepoAccessToken(
  db: any,
  userId: string | null | undefined,
  repo: string
): Promise<string | undefined> {
  if (!userId || !isGithubAppConfigured()) return undefined;

  const normalized = normalizeGithubRepo(repo);
  if (!normalized) return undefined;

  try {
    const installationId = await findInstallationIdForRepo(normalized);
    if (!installationId) return undefined;

    const owned = await db
      .select({ id: githubInstallations.id })
      .from(githubInstallations)
      .where(
        and(eq(githubInstallations.id, installationId), eq(githubInstallations.userId, userId))
      )
      .get();

    // 他人のインストールには絶対に乗らない
    if (!owned) return undefined;

    return await createInstallationToken(installationId, normalized);
  } catch (e: unknown) {
    // トークンが取れなくても公開リポジトリなら読めるので、ここでは握って続行する
    console.error("Failed to resolve GitHub App token for repo:", e);
    return undefined;
  }
}
