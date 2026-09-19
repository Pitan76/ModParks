import { apiKeys } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { isAdminUser } from "@modparks/core/auth/roles";
import { eq } from "drizzle-orm";
import type { Viewer } from "@modparks/core/auth/postAccess";
import { isOAuthAccessToken } from "@modparks/core/oauth/bearer";
import { verifyAccessToken } from "@modparks/core/oauth/tokens";

export async function validateApiKey(db: Database, request: Request) {

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, userId: null, scopes: null, error: "Missing or invalid Authorization header" };
  }

  const key = authHeader.split(" ")[1];

  // OAuth のアクセストークンも同じ Authorization ヘッダで来るため、
  // API キーとして照合する前にこちらへ振り分ける。
  if (isOAuthAccessToken(key)) {
    const token = await verifyAccessToken(db, key);
    if (!token) return { valid: false, userId: null, scopes: null, error: "Invalid or expired access token" };
    return { valid: true, userId: token.userId, scopes: token.scopes, error: null };
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const [apiKeyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, hashedKey))
    .limit(1);

  if (!apiKeyRecord) {
    return { valid: false, userId: null, scopes: null, error: "Invalid API key" };
  }

  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return { valid: false, userId: null, scopes: null, error: "API key has expired" };
  }

  try {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKeyRecord.id));
  } catch (e) {
    // Ignore update error
  }

  // API キーはスコープを持たない（全権）ため scopes は null で返す
  return { valid: true, userId: apiKeyRecord.userId, scopes: null, error: null };
}

/**
 * リクエストから canManagePost に渡せる Viewer を組み立てる。
 * APIキーが無い・無効なら匿名として扱う（エラーにはしない - 公開APIは未認証でも読める）。
 */
export async function resolveViewer(db: Database, request: Request): Promise<Viewer> {
  const auth = await validateApiKey(db, request);
  if (!auth.valid || !auth.userId) return { userId: null, isAdmin: false };

  return { userId: auth.userId, isAdmin: await isAdminUser(db, auth.userId) };
}

/**
 * スコープを要求する API 認証。
 * API キー（scopes が null）は従来どおり全権として通し、
 * OAuth トークンは必要なスコープを持つ場合だけ通す。
 */
export async function requireScope(db: Database, request: Request, scope: string) {
  const auth = await validateApiKey(db, request);
  if (!auth.valid || !auth.userId) return { ok: false as const, status: 401, error: auth.error ?? "Unauthorized" };
  if (auth.scopes && !auth.scopes.includes(scope)) {
    return { ok: false as const, status: 403, error: `Scope '${scope}' is required` };
  }
  return { ok: true as const, userId: auth.userId };
}
