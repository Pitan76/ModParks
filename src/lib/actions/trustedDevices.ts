"use server";

import { cookies, headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { trustedDevices } from "@modparks/core/db/schema";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import {
  TRUSTED_DEVICE_COOKIE,
  createTrustedDevice,
  deleteTrustedDeviceByToken,
  trustedDeviceCookieOptions,
} from "@/lib/auth/trustedDevice";

/**
 * いま使っているブラウザを信頼済みとして登録する。
 * ログイン直後（2FA を通した後）に呼ぶ想定で、以後この期間は 2FA を省略する。
 */
export async function rememberCurrentBrowser() {
  const { db, userId } = await getAuthenticatedDb();

  const userAgent = (await headers()).get("user-agent");
  const token = await createTrustedDevice(db, userId, userAgent);

  (await cookies()).set(TRUSTED_DEVICE_COOKIE, token, trustedDeviceCookieOptions());
  return { success: true };
}

/** 指定のブラウザの記憶を取り消す。今使っているブラウザなら Cookie も消す */
export async function revokeTrustedDevice(id: string) {
  const { db, userId } = await getAuthenticatedDb();

  await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)))
    .run();

  await clearCookieIfRevoked(db, userId);
  return { success: true };
}

/** すべてのブラウザの記憶を取り消す。端末を失くしたときの一括操作 */
export async function revokeAllTrustedDevices() {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId)).run();
  (await cookies()).delete(TRUSTED_DEVICE_COOKIE);
  return { success: true };
}

/**
 * 今の Cookie に対応する登録が消えていたら Cookie も落とす。
 * 残しておくと、無効なトークンを毎回照会しにいくだけになるため。
 */
async function clearCookieIfRevoked(db: Awaited<ReturnType<typeof getAuthenticatedDb>>["db"], userId: string) {
  const store = await cookies();
  const token = store.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return;

  const { isTrustedDevice } = await import("@/lib/auth/trustedDevice");
  if (await isTrustedDevice(db, userId, token)) return;

  await deleteTrustedDeviceByToken(db, userId, token);
  store.delete(TRUSTED_DEVICE_COOKIE);
}
