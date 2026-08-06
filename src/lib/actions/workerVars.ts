"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { settingsAudit } from "@/db/schema";
import { revalidatePath } from "next/cache";
import {
  getGithubConfigRepo,
  fetchWranglerToml,
  parseVars,
  createVarsPullRequest,
  PROTECTED_VARS,
} from "@/lib/utils/githubConfigRepo";

export type WorkerVar = { key: string; value: string; editable: boolean };

/** GitHub 上の wrangler.toml から現在の [vars] を読み出す */
export async function listWorkerVars(): Promise<
  { success: true; vars: WorkerVar[] } | { error: string }
> {
  await getAdminDb();

  const cfg = getGithubConfigRepo();
  if (!cfg) return { error: "GITHUB_CONFIG_REPO / GITHUB_CONFIG_TOKEN is not configured" };

  try {
    const { content } = await fetchWranglerToml(cfg);
    const vars = Object.entries(parseVars(content)).map(([key, value]) => ({
      key,
      value,
      editable: !PROTECTED_VARS.has(key),
    }));
    return { success: true, vars };
  } catch (error) {
    console.error("Failed to read worker vars:", error);
    return { error: error instanceof Error ? error.message : "Failed to read worker vars" };
  }
}

/**
 * [vars] の変更を Pull Request として提案する。
 * 反映は PR がマージされ、デプロイが走ったタイミングです。
 */
export async function proposeWorkerVarsChange(
  changes: Record<string, string>
): Promise<{ success: true; prUrl: string } | { error: string }> {
  const { db, userId, session } = await getAdminDb();

  const cfg = getGithubConfigRepo();
  if (!cfg) return { error: "GITHUB_CONFIG_REPO / GITHUB_CONFIG_TOKEN is not configured" };

  const protectedKeys = Object.keys(changes).filter((k) => PROTECTED_VARS.has(k));
  if (protectedKeys.length > 0) {
    return { error: `These vars cannot be edited from the admin UI: ${protectedKeys.join(", ")}` };
  }
  if (Object.keys(changes).length === 0) return { error: "No changes provided" };

  try {
    const { content } = await fetchWranglerToml(cfg);
    const current = parseVars(content);

    // 実際に値が変わるものだけを対象にする
    const effective = Object.fromEntries(
      Object.entries(changes).filter(([k, v]) => current[k] !== v)
    );
    if (Object.keys(effective).length === 0) return { error: "No changes provided" };

    const authorLabel = session.user?.email ?? userId;
    const prUrl = await createVarsPullRequest(cfg, effective, authorLabel);

    await db.insert(settingsAudit).values(
      Object.entries(effective).map(([key, value]) => ({
        scope: "vars" as const,
        key,
        oldValue: current[key] ?? null,
        newValue: value,
        prUrl,
        changedBy: userId,
        // authorLabel はセッション上のメールなので、そのまま監査ログにも残す
        changedByEmail: session.user?.email ?? undefined,
      }))
    );

    revalidatePath("/admin/config");
    return { success: true, prUrl };
  } catch (error) {
    console.error("Failed to propose worker vars change:", error);
    return { error: error instanceof Error ? error.message : "Failed to create pull request" };
  }
}
