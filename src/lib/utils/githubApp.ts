import * as core from "@modparks/core/github/app";

/**
 * GitHub App（Next 側のアダプタ）。本体は core/github/app.ts。
 * App の資格情報を process.env から取って渡すだけ。
 */
export function nextGithubAppConfig(): core.GithubAppConfig | null {
  return core.githubAppConfig(process.env.GITHUB_APP_ID, process.env.GITHUB_APP_PRIVATE_KEY);
}

/** App のインストール開始 URL。未設定なら null */
export function getGithubAppInstallUrl(): string | null {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return null;
  return `https://github.com/apps/${slug}/installations/new`;
}

export async function createInstallationToken(installationId: number, repoFullName?: string): Promise<string> {
  const app = nextGithubAppConfig();
  if (!app) throw new Error("GitHub App is not configured.");

  return core.createInstallationToken(app, installationId, repoFullName);
}
