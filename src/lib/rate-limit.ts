import { getDatabase } from "./db";
import { rateLimits } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { headers } from "next/headers";

/** subject をキーに含める際の最大長。攻撃者が任意長の値を送れるため上限を設ける */
const SUBJECT_MAX_LENGTH = 64;

/**
 * IP（＋任意の subject）単位でレート制限を判定する。
 *
 * @param subject IPに加えて絞り込むキー（例: ログイン識別子）。
 *   共有IP環境で無関係な利用者を巻き込まないために指定する。
 */
/**
 * リクエスト元のIPを解決する。
 *
 * headers() はリクエストスコープでしか読めないため、after() など
 * レスポンス後に走る処理では、レンダリング中にこれを呼んで値を渡すこと。
 */
export async function resolveClientIp(): Promise<string> {
  const reqHeaders = await headers();
  // cf-connecting-ip はCloudflareが付与する信頼できる値。
  // x-forwarded-for はクライアント改変可能なため、優先せず先頭要素のみ採用する
  return (
    reqHeaders.get("cf-connecting-ip") ||
    reqHeaders.get("x-forwarded-for")?.split(",")[0].trim() ||
    "127.0.0.1"
  );
}

/**
 * @param clientIp 解決済みのIP。リクエストスコープ外から呼ぶ場合に渡す
 */
export async function checkRateLimit(action: string, limit: number, windowMs: number, subject?: string, clientIp?: string) {
  const ip = clientIp ?? (await resolveClientIp());
  const scope = subject ? `${subject.slice(0, SUBJECT_MAX_LENGTH)}:${ip}` : ip;
  const id = `rate:${action}:${scope}`;

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

/**
 * 期限切れのレート制限レコードを削除する。
 * subject 付きのキーは値の種類だけ行が増えるため、定期的な掃除が必要。
 */
export async function purgeExpiredRateLimits() {
  const db = await getDatabase();
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
}
