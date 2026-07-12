import { getDatabase } from "./db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function checkRateLimit(action: string, limit: number, windowMs: number) {
  const reqHeaders = await headers();
  // cf-connecting-ip はCloudflareが付与する信頼できる値。
  // x-forwarded-for はクライアント改変可能なため、優先せず先頭要素のみ採用する
  const ip =
    reqHeaders.get("cf-connecting-ip") ||
    reqHeaders.get("x-forwarded-for")?.split(",")[0].trim() ||
    "127.0.0.1";
  const id = `rate:${action}:${ip}`;

  const db = await getDatabase();
  const now = Date.now();

  const record = await db.select().from(rateLimits).where(eq(rateLimits.id, id)).get();

  if (!record) {
    await db.insert(rateLimits).values({
      id,
      count: 1,
      expiresAt: new Date(now + windowMs),
    });
    return { success: true };
  }

  if (record.expiresAt.getTime() < now) {
    // expired, reset
    await db.update(rateLimits).set({
      count: 1,
      expiresAt: new Date(now + windowMs),
    }).where(eq(rateLimits.id, id));
    return { success: true };
  }

  if (record.count >= limit) {
    return { success: false, error: "Too many requests" };
  }

  await db.update(rateLimits).set({
    count: record.count + 1,
  }).where(eq(rateLimits.id, id));

  return { success: true };
}
