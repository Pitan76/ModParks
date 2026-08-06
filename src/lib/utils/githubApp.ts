/**
 * GitHub App による非公開リポジトリのアクセス。
 *
 * ユーザーの OAuth トークン（repo scope）を使わないのは、repo が非公開リポジトリへの
 * 書き込み権限まで含むため。GitHub App なら contents:read だけを要求でき、
 * さらにユーザーがインストール時に対象リポジトリを個別に選べる。
 *
 * 必要な環境変数:
 *   GITHUB_APP_ID           App の ID（数値）
 *   GITHUB_APP_PRIVATE_KEY  App の秘密鍵（PKCS#8 PEM。改行は \n でも可）
 *   GITHUB_APP_SLUG         インストール用 URL の組み立てに使う App の slug
 */
const GITHUB_API = "https://api.github.com";

/** App JWT の有効期間。GitHub の上限は 10 分だが、時計ずれを見て短めに取る */
const APP_JWT_TTL_SEC = 8 * 60;

/** installation token は 1 時間有効。期限より前に取り直す余裕 */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function appHeaders(bearer: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ModParks/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${bearer}`,
  };
}

export function isGithubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

/** App のインストール開始 URL。未設定なら null */
export function getGithubAppInstallUrl(): string | null {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return null;
  return `https://github.com/apps/${slug}/installations/new`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/** PKCS#8 PEM をパースして Web Crypto の CryptoKey にする */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, "\n").trim();
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");

  if (!body) throw new Error("GITHUB_APP_PRIVATE_KEY is empty or malformed.");
  if (/BEGIN RSA PRIVATE KEY/.test(normalized)) {
    // GitHub が配布するのは PKCS#1。Web Crypto は PKCS#8 しか読めない。
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY is in PKCS#1 format. Convert it to PKCS#8: " +
        "openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key.pkcs8.pem"
    );
  }

  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/** App 自身を名乗るための JWT（RS256）を作る */
async function createAppJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new Error("GitHub App is not configured.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlEncodeJson({
    // 時計ずれで "iat is in the future" を食らわないよう 60 秒戻す
    iat: now - 60,
    exp: now + APP_JWT_TTL_SEC,
    iss: appId,
  });

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * リポジトリに対応する installation を引く。
 * App が入っていない場合は 404 が返るので null。
 */
export async function findInstallationIdForRepo(repoFullName: string): Promise<number | null> {
  const jwt = await createAppJwt();
  const res = await fetch(`${GITHUB_API}/repos/${repoFullName}/installation`, {
    headers: appHeaders(jwt),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to look up GitHub App installation. Status: ${res.status}`);

  const data = (await res.json()) as { id?: number };
  return data?.id ?? null;
}

/** installation token のプロセス内キャッシュ。Worker のインスタンス内でのみ有効 */
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

/**
 * installation token を発行する。
 * repoFullName を渡すと、そのリポジトリ 1 件だけに絞ったトークンになる。
 */
export async function createInstallationToken(
  installationId: number,
  repoFullName?: string
): Promise<string> {
  // リポジトリを絞ったトークンは用途が限定されるためキャッシュしない
  if (!repoFullName) {
    const cached = tokenCache.get(installationId);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) return cached.token;
  }

  const jwt = await createAppJwt();
  const repoName = repoFullName?.split("/")[1];

  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...appHeaders(jwt), "Content-Type": "application/json" },
    body: JSON.stringify(
      repoName ? { repositories: [repoName], permissions: { contents: "read" } } : {}
    ),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to create GitHub App installation token. Status: ${res.status}`);
  }

  const data = (await res.json()) as { token: string; expires_at: string };
  if (!repoFullName) {
    tokenCache.set(installationId, {
      token: data.token,
      expiresAt: new Date(data.expires_at).getTime(),
    });
  }
  return data.token;
}
