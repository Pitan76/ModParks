/**
 * 「このブラウザを記憶する」（2FA の省略）の中核。
 *
 * Cookie には生トークンだけを置き、DB にはその SHA-256 を保存する。
 * DB が漏れても、その値だけでは 2FA を迂回できないようにするため。
 */
import { and, eq, gt } from "drizzle-orm";
import { trustedDevices } from "@modparks/core/db/schema";
import { sha256Hex } from "@/lib/oauth/crypto";
import type { Database } from "@/lib/db";

export const TRUSTED_DEVICE_COOKIE = "mp_trusted_device";

/** 記憶する期間。長すぎると 2FA の意味が薄れるため 30 日で切る */
export const TRUSTED_DEVICE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** Cookie に載せるトークンを作る（128bit の乱数を hex 化） */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * このブラウザが指定ユーザーの信頼済みデバイスかを判定する。
 * 判定に通ったら最終利用日時を更新する（一覧で「使われていない端末」を見分けるため）。
 */
export async function isTrustedDevice(db: Database, userId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const tokenHash = await sha256Hex(token);
  const row = await db
    .select({ id: trustedDevices.id })
    .from(trustedDevices)
    .where(and(
      eq(trustedDevices.tokenHash, tokenHash),
      eq(trustedDevices.userId, userId),
      gt(trustedDevices.expiresAt, new Date()),
    ))
    .get();

  if (!row) return false;

  await db.update(trustedDevices).set({ lastUsedAt: new Date() }).where(eq(trustedDevices.id, row.id)).run();
  return true;
}

/**
 * 信頼済みデバイスを1件登録し、Cookie に載せる生トークンを返す。
 *
 * @param userAgent 一覧で本人が端末を見分けるための手掛かり
 */
export async function createTrustedDevice(db: Database, userId: string, userAgent: string | null): Promise<string> {
  const token = generateToken();

  await db.insert(trustedDevices).values({
    userId,
    tokenHash: await sha256Hex(token),
    userAgent,
    expiresAt: new Date(Date.now() + TRUSTED_DEVICE_MAX_AGE_SEC * 1000),
  }).run();

  return token;
}

/** Cookie のトークンに対応する登録を消す（ログアウト時や記憶の取り消し） */
export async function deleteTrustedDeviceByToken(db: Database, userId: string, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.tokenHash, tokenHash), eq(trustedDevices.userId, userId)))
    .run();
}

/** リクエストの Cookie を見て、このブラウザが信頼済みかを判定する */
export async function isTrustedBrowserRequest(db: Database, userId: string): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
  return isTrustedDevice(db, userId, token);
}

/** Cookie に信頼済みデバイスのトークンを載せる設定値 */
export function trustedDeviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRUSTED_DEVICE_MAX_AGE_SEC,
  };
}
