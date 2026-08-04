/**
 * OAuth アクセストークンによるリクエスト認証。
 * API キー認証（lib/api-auth.ts）と並ぶもう一つの入口で、こちらはスコープを持つ。
 */
import { verifyAccessToken } from "./tokens";
import { bearerError } from "./errors";

export type BearerAuth = { userId: string; clientId: string; scopes: string[] };

/** Authorization: Bearer からトークン文字列を取り出す */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** OAuth トークンとして解釈できる形式か。API キーと取り違えないための前置き判定 */
export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith("mpat_");
}

export async function authenticateBearer(request: Request): Promise<BearerAuth | null> {
  const token = readBearerToken(request);
  if (!token || !isOAuthAccessToken(token)) return null;
  return verifyAccessToken(token);
}

type RequireResult =
  | { ok: true; token: BearerAuth }
  | { ok: false; response: ReturnType<typeof bearerError> };

/** 指定スコープを持つアクセストークンを要求する。足りなければ 401/403 を返す */
export async function requireBearerScope(request: Request, scope: string): Promise<RequireResult> {
  const token = await authenticateBearer(request);
  if (!token) return { ok: false, response: bearerError("invalid_token", "Access token is missing, invalid, or expired") };
  if (!token.scopes.includes(scope)) {
    return { ok: false, response: bearerError("insufficient_scope", `Scope '${scope}' is required`, scope) };
  }
  return { ok: true, token };
}
