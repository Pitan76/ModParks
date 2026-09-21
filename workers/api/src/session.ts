import { getToken } from "@auth/core/jwt";
import type { Database } from "@modparks/core/db/client";
import { isAccountActive } from "@modparks/core/auth/accountStatus";

/**
 * Auth.js のセッション Cookie を Next の外で検証する。
 *
 * Next 側のセッションは strategy: "jwt" なので、状態は暗号化された Cookie に
 * 閉じており、AUTH_SECRET さえあれば Hono からでも復号できる。
 *
 * ただし Next 側は jwt コールバックで 5 分ごとに DB を見直し、削除・停止・
 * 凍結されたユーザーを session コールバックで弾いている。トークン内の
 * isSuspended などのフラグはその結果でしかなく、Next を通らない限り更新されない。
 * ここではトークンのフラグを信用せず、必ず DB で最新の状態を確かめる。
 */
export type SessionUser = { userId: string };

/**
 * Cookie からユーザーIDを取り出す。DB は見ない。
 *
 * 分割 Cookie（4 KB を超えると .0 .1 … に分かれる）の再結合と、
 * Cookie 名を salt にした復号は getToken が行う。
 * @param req 受け取ったリクエスト
 * @param secret AUTH_SECRET。Next 側と同じ値でなければ復号できない
 */
export async function readSessionUserId(req: Request, secret: string): Promise<string | null> {
  // https では Auth.js が __Secure- 接頭辞の Cookie 名を使うため、それに合わせる
  const secureCookie = new URL(req.url).protocol === "https:";
  // Authorization ヘッダは API キー / OAuth の経路なので、セッションとして読ませない
  const cookieOnly = new Request(req.url, { headers: { cookie: req.headers.get("cookie") ?? "" } });

  const token = await getToken({ req: cookieOnly, secret, secureCookie });
  const userId = token?.sub ?? (token as { id?: unknown } | null)?.id;

  return typeof userId === "string" && userId ? userId : null;
}

/**
 * セッションを検証し、使ってよいユーザーだけを返す。
 * @param db データベース接続
 * @param req 受け取ったリクエスト
 * @param secret AUTH_SECRET
 */
export async function readSession(db: Database, req: Request, secret: string): Promise<SessionUser | null> {
  const userId = await readSessionUserId(req, secret);
  if (!userId) return null;
  if (!(await isAccountActive(db, userId))) return null;

  return { userId };
}
