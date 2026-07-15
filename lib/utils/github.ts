/**
 * GitHub API 連携ユーティリティ
 * 公開リポジトリの Release / アセット取得を行います（公開リポジトリは認証不要）。
 * トークンがある場合はレートリミット緩和・非公開リポジトリ対応のため付与します。
 */

export interface GithubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  assets: GithubReleaseAsset[];
}

const GITHUB_API = "https://api.github.com";

/** "owner/repo" や GitHub の URL からリポジトリ識別子を正規化する */
export function normalizeGithubRepo(input: string): string | null {
  if (!input) return null;
  let s = input.trim();
  // URL 形式を許容
  const urlMatch = s.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (urlMatch) {
    s = `${urlMatch[1]}/${urlMatch[2]}`;
  }
  s = s.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return `${owner}/${repo}`;
}

function ghHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ModParks/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 指定リポジトリの Release 一覧を取得する（新しい順） */
export async function fetchGithubReleases(repo: string, token?: string): Promise<GithubRelease[]> {
  const normalized = normalizeGithubRepo(repo);
  if (!normalized) throw new Error("Invalid GitHub repository. Use 'owner/repo' format.");

  const res = await fetch(`${GITHUB_API}/repos/${normalized}/releases?per_page=30`, {
    headers: ghHeaders(token),
    next: { revalidate: 300 },
  });

  if (res.status === 404) throw new Error("GitHub repository or releases not found.");
  if (res.status === 403) throw new Error("GitHub API rate limit exceeded. Please try again later.");
  if (!res.ok) throw new Error(`Failed to fetch GitHub releases. Status: ${res.status}`);

  const data = (await res.json()) as GithubRelease[];
  return data.filter((r) => !r.draft);
}

/** 指定リポジトリの最新の（下書きでない）Release を取得する。プレリリースはスキップ */
export async function fetchLatestGithubRelease(repo: string, token?: string): Promise<GithubRelease | null> {
  const releases = await fetchGithubReleases(repo, token);
  const stable = releases.find((r) => !r.prerelease);
  return stable ?? releases[0] ?? null;
}

/** Release のアセットから取り込むべき .jar を選ぶ。無ければ .zip、それも無ければ null */
export function pickPrimaryAsset(release: GithubRelease): GithubReleaseAsset | null {
  const isDist = (a: GithubReleaseAsset) => {
    const n = a.name.toLowerCase();
    // sources / javadoc / dev などの補助成果物を除外
    return !/(sources|javadoc|-dev|-api|-slim)\.jar$/i.test(n);
  };
  const jars = release.assets.filter((a) => a.name.toLowerCase().endsWith(".jar"));
  const primaryJar = jars.find(isDist) ?? jars[0];
  if (primaryJar) return primaryJar;
  const zip = release.assets.find((a) => a.name.toLowerCase().endsWith(".zip"));
  return zip ?? null;
}

/** アセットをダウンロードして ArrayBuffer を返す */
export async function downloadGithubAsset(asset: GithubReleaseAsset, token?: string): Promise<ArrayBuffer> {
  const res = await fetch(asset.browser_download_url, {
    headers: token ? { Authorization: `Bearer ${token}`, "User-Agent": "ModParks/1.0" } : { "User-Agent": "ModParks/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to download asset '${asset.name}'. Status: ${res.status}`);
  return res.arrayBuffer();
}
