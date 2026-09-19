import type { Database } from "@modparks/core/db/client";
import { rateLimits } from "@modparks/core/db/schema";
import { eq, lt } from "drizzle-orm";

/** subject をキーに含める際の最大長。攻撃者が任意長の値を送れるため上限を設ける */
const SUBJECT_MAX_LENGTH = 64;

/**
 * リクエスト元のIPをヘッダから読む。
 *
 * アンビエントな headers() には触れない。Next 側は cookies()/headers() から、
 * Workers 側は Request.headers から取った Headers をそのまま渡すこと。
 */
export function readClientIp(reqHeaders: Headers): string {
  // cf-connecting-ip はCloudflareが付与する信頼できる値。
  // x-forwarded-for はクライアント改変可能なため、優先せず先頭要素のみ採用する
  return (
    reqHeaders.get("cf-connecting-ip") ||
    reqHeaders.get("x-forwarded-for")?.split(",")[0].trim() ||
    "127.0.0.1"
  );
}

/**
 * IP（＋任意の subject）単位でレート制限を判定する。
 *
 * @param subject IPに加えて絞り込むキー（例: ログイン識別子）。
 *   共有IP環境で無関係な利用者を巻き込まないために指定する。
 * @param clientIp 解決済みのIP。呼び出し側が readClientIp で得たもの
 */
export async function checkRateLimit(
  db: Database,
  action: string,
  limit: number,
  windowMs: number,
  subject: string | undefined,
  clientIp: string,
) {
  const scope = subject ? `${subject.slice(0, SUBJECT_MAX_LENGTH)}:${clientIp}` : clientIp;
  const id = `rate:${action}:${scope}`;
  const now = Date.now();

  const record = await db.select().from(rateLimits).where(eq(rateLimits.id, id)).get();

  if (!record) {
    await db.insert(rateLimits).values({ id, count: 1, expiresAt: new Date(now + windowMs) });
    return { success: true };
  }

  if (record.expiresAt.getTime() < now) {
    await db.update(rateLimits)
      .set({ count: 1, expiresAt: new Date(now + windowMs) })
      .where(eq(rateLimits.id, id));
    return { success: true };
  }

  if (record.count >= limit) return { success: false, error: "Too many requests" };

  await db.update(rateLimits).set({ count: record.count + 1 }).where(eq(rateLimits.id, id));

  return { success: true };
}

/**
 * 期限切れのレート制限レコードを削除する。
 * subject 付きのキーは値の種類だけ行が増えるため、定期的な掃除が必要。
 */
export async function purgeExpiredRateLimits(db: Database) {
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
}
