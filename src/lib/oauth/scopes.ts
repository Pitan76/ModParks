/**
 * OAuth スコープの定義と正規化。
 * 追加するときは必ずここと lang の Settings.oauthApps.scopes を対で更新する。
 */

/** 定義済みスコープ。値は同意画面の i18n キーにもそのまま使う */
export const OAUTH_SCOPES = [
  "openid",
  "email",
  "profile:read",
  "projects:read",
  "projects:write",
  "versions:read",
  "versions:write",
  "ideas:read",
  "ideas:write",
  "comments:write",
  "notifications:read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

/** クライアント登録時の既定スコープ。読み取りだけを最初から持たせる */
export const DEFAULT_CLIENT_SCOPES: OAuthScope[] = ["openid", "profile:read", "projects:read"];

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

/** スペース区切り文字列を、重複を除いた既知スコープの配列にする */
export function parseScope(raw: string | null | undefined): OAuthScope[] {
  if (!raw) return [];
  const seen = new Set<OAuthScope>();
  for (const part of raw.trim().split(/\s+/)) {
    if (isOAuthScope(part)) seen.add(part);
  }
  return [...seen];
}

export function formatScope(scopes: readonly string[]): string {
  return scopes.join(" ");
}

/** requested がすべて allowed に含まれるか */
export function isSubsetOf(requested: readonly string[], allowed: readonly string[]): boolean {
  return requested.every((s) => allowed.includes(s));
}

/**
 * 要求スコープを、クライアントに許可された範囲へ絞り込む。
 * 未知のスコープが混ざっていた場合は invalid_scope として扱えるよう unknown を返す。
 */
export function resolveRequestedScope(raw: string | null, clientScopes: readonly string[]) {
  const requestedRaw = raw?.trim() ? raw.trim().split(/\s+/) : [];
  const unknown = requestedRaw.filter((s) => !isOAuthScope(s));
  if (unknown.length > 0) return { ok: false as const, unknown };

  const requested = requestedRaw.length > 0 ? parseScope(raw) : parseScope(formatScope(clientScopes));
  if (!isSubsetOf(requested, clientScopes)) return { ok: false as const, unknown: requested.filter((s) => !clientScopes.includes(s)) };
  if (requested.length === 0) return { ok: false as const, unknown: [] };

  return { ok: true as const, scopes: requested };
}
