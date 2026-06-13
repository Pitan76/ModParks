import { getDb, getD1 } from "@/lib/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function validateApiKey(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, userId: null, error: "Missing or invalid Authorization header" };
  }

  const key = authHeader.split(" ")[1];
  
  const [apiKeyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, key))
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
