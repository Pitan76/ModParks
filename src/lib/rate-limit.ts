import { headers } from "next/headers";
import { getDatabase } from "./db";
import { readClientIp, checkRateLimit as checkRateLimitCore, purgeExpiredRateLimits as purgeCore } from "@modparks/core/rate-limit";

/**
 * Next 側のアダプタ。判定そのものは core にあり、ここは
 * アンビエントな headers() と getDatabase() を解決するだけ。
 */

export { readClientIp };

/**
 * リクエスト元のIPを解決する。
 *
 * headers() はリクエストスコープでしか読めないため、after() など
 * レスポンス後に走る処理では、レンダリング中にこれを呼んで値を渡すこと。
 */
export async function resolveClientIp(): Promise<string> {
  return readClientIp(await headers());
}

/**
 * @param clientIp 解決済みのIP。リクエストスコープ外から呼ぶ場合に渡す
 */
export async function checkRateLimit(action: string, limit: number, windowMs: number, subject?: string, clientIp?: string) {
  const ip = clientIp ?? (await resolveClientIp());

  return checkRateLimitCore(await getDatabase(), action, limit, windowMs, subject, ip);
}

export async function purgeExpiredRateLimits() {
  return purgeCore(await getDatabase());
}
