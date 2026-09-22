import type { GithubCredentials } from "@modparks/core/versions/githubImport";
import { nextGithubAppConfig } from "@/lib/utils/githubApp";

/** GitHub への認証に使う秘密値（Next 側）。process.env から取る */
export function nextGithubCredentials(): GithubCredentials {
  return { serverToken: process.env.GITHUB_TOKEN || undefined, app: nextGithubAppConfig() };
}
