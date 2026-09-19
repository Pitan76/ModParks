"use server";

import { cookies, headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { trustedDevices } from "@modparks/core/db/schema";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import {
  TRUSTED_DEVICE_COOKIE,
  createTrustedDevice,
  deleteTrustedDeviceByToken,
  trustedDeviceCookieOptions,
} from "@/lib/auth/trustedDevice";

/** 設定画面に出す信頼済みデバイス1件 */
export type TrustedDeviceSummary = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  /** 今使っているブラウザかどうか（一覧で自分を見分けるため） */
  current: boolean;
};

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

/** 登録済みのブラウザ一覧。新しいものから並べる */
export async function listTrustedDevices(): Promise<TrustedDeviceSummary[]> {
  const { db, userId } = await getAuthenticatedDb();
  const currentToken = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;

  const { sha256Hex } = await import("@/lib/oauth/crypto");
  const currentHash = currentToken ? await sha256Hex(currentToken) : null;

  const rows = await db
    .select()
    .from(trustedDevices)
    .where(eq(trustedDevices.userId, userId))
    .orderBy(desc(trustedDevices.createdAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    current: !!currentHash && row.tokenHash === currentHash,
  }));
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
