import { desc, eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { trustedDevices } from "@modparks/core/db/schema";
import { sha256Hex } from "@modparks/core/oauth/crypto";

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
 * 本人の信頼済みデバイス一覧。新しいものから並べる。
 *
 * Cookie の取り方は Next と Workers で違うので、トークンは受け取る。
 * DB にはハッシュしか無いので、同じ方式でハッシュして「今のブラウザ」を見分ける。
 * @param db データベース接続
 * @param userId セッションで確かめた本人のユーザーID
 * @param currentToken このブラウザの mp_trusted_device Cookie。無ければ undefined
 */
export async function listTrustedDeviceSummaries(db: Database, userId: string, currentToken: string | undefined): Promise<TrustedDeviceSummary[]> {
  const currentHash = currentToken ? await sha256Hex(currentToken) : null;
  const rows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).orderBy(desc(trustedDevices.createdAt)).all();

  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    current: !!currentHash && row.tokenHash === currentHash,
  }));
}
