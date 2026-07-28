import { getDatabase } from "@/lib/db";
import { apiKeys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/postAccess";

export async function validateApiKey(request: Request) {
  const db = await getDatabase();

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, userId: null, error: "Missing or invalid Authorization header" };
  }

  const key = authHeader.split(" ")[1];
  
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
    return { valid: false, userId: null, error: "Invalid API key" };
  }
  
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return { valid: false, userId: null, error: "API key has expired" };
  }

  try {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKeyRecord.id));
  } catch (e) {
    // Ignore update error
  }

  return { valid: true, userId: apiKeyRecord.userId, error: null };
}

/**
 * リクエストから canManagePost に渡せる Viewer を組み立てる。
 * APIキーが無い・無効なら匿名として扱う（エラーにはしない — 公開APIは未認証でも読める）。
 */
export async function resolveViewer(request: Request): Promise<Viewer> {
  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) return { userId: null, isAdmin: false };

  const db = await getDatabase();
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, auth.userId)).get();
  return { userId: auth.userId, isAdmin: user?.role === "admin" };
}
