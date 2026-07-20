/**
 * wrangler.toml を GitHub 上で編集するためのユーティリティ。
 *
 * Worker の [vars] は `wrangler deploy` のたびに wrangler.toml の内容で上書きされるため、
 * Cloudflare API を直接叩いても次のデプロイで巻き戻ります。
 * そのため vars の変更は「GitHub 上の wrangler.toml を書き換える Pull Request」として行います。
 */
import { parse as parseToml } from "smol-toml";

const GITHUB_API = "https://api.github.com";

/** 設定リポジトリ内での wrangler.toml のパス */
export const WRANGLER_PATH = "wrangler.toml";

/** UI から編集させない vars（アプリの動作に直結し、誤設定の影響が大きいもの） */
export const PROTECTED_VARS = new Set(["AUTH_TRUST_HOST"]);

export type GithubRepoConfig = { owner: string; repo: string; token: string };

/**
 * 環境変数から設定リポジトリの情報を取得する。
 * GITHUB_CONFIG_REPO は "owner/repo" 形式、GITHUB_CONFIG_TOKEN は contents:write と
 * pull_requests:write を持つトークン。
 */
export function getGithubConfigRepo(): GithubRepoConfig | null {
  const slug = process.env.GITHUB_CONFIG_REPO;
  const token = process.env.GITHUB_CONFIG_TOKEN;
  if (!slug || !token) return null;
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) return null;
  return { owner, repo, token };
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ModParks-Admin",
  };
}

async function gh<T>(cfg: GithubRepoConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...headers(cfg.token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** wrangler.toml の現在の内容と blob SHA を取得する */
export async function fetchWranglerToml(
  cfg: GithubRepoConfig,
  ref?: string
): Promise<{ content: string; sha: string }> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const data = await gh<{ content: string; sha: string; encoding: string }>(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/contents/${WRANGLER_PATH}${query}`
  );
  return { content: decodeBase64(data.content), sha: data.sha };
}

/** wrangler.toml の [vars] セクションを読み出す */
export function parseVars(tomlText: string): Record<string, string> {
  const parsed = parseToml(tomlText) as { vars?: Record<string, unknown> };
  const vars = parsed.vars ?? {};
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)]));
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * [vars] セクション内の該当キーの行だけを差し替える（コメントや整形を保持するため行ベース）。
 * セクション内に存在しないキーは末尾に追記する。
 */
export function applyVarChanges(tomlText: string, changes: Record<string, string>): string {
  const lines = tomlText.split("\n");
  const start = lines.findIndex((line) => line.trim() === "[vars]");
  if (start === -1) throw new Error("[vars] section not found in wrangler.toml");

  // 次のセクション見出しまでが [vars] の範囲
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const remaining = new Map(Object.entries(changes));
  for (let i = start + 1; i < end; i++) {
    const match = lines[i].match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*)=/);
    if (!match) continue;
    const key = match[2];
    if (!remaining.has(key)) continue;
    lines[i] = `${match[1]}${key} = "${escapeTomlString(remaining.get(key)!)}"`;
    remaining.delete(key);
  }

  if (remaining.size > 0) {
    // 末尾の空行の手前に挿入して、セクション区切りを崩さない
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
    const additions = [...remaining].map(([k, v]) => `${k} = "${escapeTomlString(v)}"`);
    lines.splice(insertAt, 0, ...additions);
  }

  return lines.join("\n");
}

/**
 * wrangler.toml の [vars] を書き換える Pull Request を作成する。
 * @returns 作成された PR の URL
 */
export async function createVarsPullRequest(
  cfg: GithubRepoConfig,
  changes: Record<string, string>,
  authorLabel: string
): Promise<string> {
  const repoInfo = await gh<{ default_branch: string }>(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
  const base = repoInfo.default_branch;

  const baseRef = await gh<{ object: { sha: string } }>(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${base}`
  );

  const branch = `chore/update-vars-${Date.now()}`;
  await gh(cfg, `/repos/${cfg.owner}/${cfg.repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
  });

  const { content, sha } = await fetchWranglerToml(cfg, base);
  const updated = applyVarChanges(content, changes);
  if (updated === content) throw new Error("No changes to apply");

  const keys = Object.keys(changes).join(", ");
  await gh(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${WRANGLER_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore: update worker vars (${keys})`,
      content: encodeBase64(updated),
      sha,
      branch,
    }),
  });

  const body = [
    "管理画面から作成された Worker vars の変更です。",
    "",
    "| キー | 新しい値 |",
    "| --- | --- |",
    ...Object.entries(changes).map(([k, v]) => `| \`${k}\` | \`${v}\` |`),
    "",
    `変更者: ${authorLabel}`,
  ].join("\n");

  const pr = await gh<{ html_url: string }>(cfg, `/repos/${cfg.owner}/${cfg.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: `chore: update worker vars (${keys})`, head: branch, base, body }),
  });

  return pr.html_url;
}
