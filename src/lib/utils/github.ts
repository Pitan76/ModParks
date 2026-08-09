/**
 * GitHub API 連携ユーティリティ
 * 公開リポジトリの Release / アセット取得を行います（公開リポジトリは認証不要）。
 * トークンがある場合はレートリミット緩和・非公開リポジトリ対応のため付与します。
 */

export interface GithubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  /** API 上のアセット URL。非公開リポジトリはこちらでないと取得できない */
  url: string;
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

/**
 * Release の取り込み方式。
 * - `file`: アセットを ModParks（R2）へ取り込み、自前で配信する
 * - `link`: アセットを取り込まず、GitHub の配布 URL を外部リンクとして登録する
 */
export type GithubImportMode = "file" | "link";

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

/**
 * 明示的にトークンが渡されなかった場合に使う既定トークン。
 * 未認証だと 60 req/hour（送信元 IP 単位）で、Worker の共有 IP ではすぐ枯渇するため、
 * 公開リポジトリの読み取り専用トークンを付けて 5000 req/hour にする。
 *
 * ここで GITHUB_CONFIG_TOKEN（設定リポジトリへの write 権限を持つ）にフォールバックしてはいけない。
 * 対象リポジトリはユーザーが任意に指定できるため、特権トークンをそこへ送ることになる。
 */
function defaultGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
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

/**
 * 403 / 429 の実際の原因を切り分けてメッセージにする。
 * GitHub の 403 はレートリミット以外（権限不足・トークン失効・secondary rate limit など）でも返るため、
 * ヘッダを見ずに「rate limit」と決めつけない。
 */
async function describeGithubThrottle(res: Response): Promise<string> {
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  const retryAfter = res.headers.get("retry-after");

  if (remaining === "0") {
    const at = reset ? new Date(Number(reset) * 1000).toISOString() : null;
    const authed = res.headers.get("x-ratelimit-limit");
    const scope = authed && Number(authed) <= 60 ? " (unauthenticated: 60 req/hour)" : "";
    return `GitHub API rate limit exceeded${scope}.${at ? ` Resets at ${at}.` : " Please try again later."}`;
  }
  if (retryAfter) {
    return `GitHub API secondary rate limit. Retry after ${retryAfter}s.`;
  }

  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) detail = `: ${body.message}`;
  } catch {
    // ボディが JSON でない場合は詳細なし
  }
  return `GitHub API request was refused (${res.status})${detail}`;
}

/** 指定リポジトリの Release 一覧を取得する（新しい順） */
export async function fetchGithubReleases(repo: string, token?: string): Promise<GithubRelease[]> {
  const normalized = normalizeGithubRepo(repo);
  if (!normalized) throw new Error("Invalid GitHub repository. Use 'owner/repo' format.");

  // ユーザー個人のトークンを使う場合は、非公開リポジトリの応答が
  // データキャッシュ経由で他のユーザーへ渡らないようキャッシュしない。
  const isUserToken = Boolean(token);
  const res = await fetch(`${GITHUB_API}/repos/${normalized}/releases?per_page=30`, {
    headers: ghHeaders(token ?? defaultGithubToken()),
    ...(isUserToken ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
  });

  // 非公開リポジトリはトークンが無い/権限不足でも 404 が返る（存在を秘匿するため）
  if (res.status === 404) {
    throw new Error(
      isUserToken
        ? "GitHub repository or releases not found, or your GitHub account cannot access it."
        : "GitHub repository or releases not found. If it is private, link your GitHub account."
    );
  }
  if (res.status === 401) throw new Error("GitHub authentication failed. The configured token is invalid or expired.");
  if (res.status === 403 || res.status === 429) throw new Error(await describeGithubThrottle(res));
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

/** Release のアセットから取り込むべき主要アセット（.jar、無ければ .zip）をすべて抽出する */
export function pickPrimaryAssets(release: GithubRelease): GithubReleaseAsset[] {
  const isDist = (a: GithubReleaseAsset) => {
    const n = a.name.toLowerCase();
    // sources / javadoc / dev などの補助成果物を除外
    return !/(sources|javadoc|-dev|-api|-slim)\.jar$/i.test(n);
  };
  const jars = release.assets.filter((a) => a.name.toLowerCase().endsWith(".jar") && isDist(a));
  if (jars.length > 0) return jars;
  const zip = release.assets.find((a) => a.name.toLowerCase().endsWith(".zip"));
  return zip ? [zip] : [];
}

/**
 * アセットをダウンロードして ArrayBuffer を返す。
 *
 * トークンがある場合は API のアセット URL を octet-stream で叩く。
 * browser_download_url は非公開リポジトリでは認証が通らないため。
 */
export async function downloadGithubAsset(asset: GithubReleaseAsset, token?: string): Promise<ArrayBuffer> {
  const effective = token ?? defaultGithubToken();
  const useApiUrl = Boolean(effective && asset.url);

  let res = await fetch(useApiUrl ? asset.url : asset.browser_download_url, {
    headers: {
      "User-Agent": "ModParks/1.0",
      ...(effective ? { Authorization: `Bearer ${effective}` } : {}),
      ...(useApiUrl ? { Accept: "application/octet-stream" } : {}),
    },
    // API のアセット URL は署名付きストレージ URL へリダイレクトする。
    // Authorization を引き継ぐと署名と衝突して 400 になるため、手動で辿り直す。
    redirect: useApiUrl ? "manual" : "follow",
  });

  if (useApiUrl && res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new Error(`Failed to download asset '${asset.name}'. Redirect without location.`);
    res = await fetch(location, {
      headers: { "User-Agent": "ModParks/1.0" },
      redirect: "follow",
    });
  }

  if (!res.ok) throw new Error(`Failed to download asset '${asset.name}'. Status: ${res.status}`);
  return res.arrayBuffer();
}
