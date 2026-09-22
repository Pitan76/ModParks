/**
 * ChreeID のサーバ間 API (`/api/v1/service-accounts/...`) を呼ぶための薄い層。
 *
 * ログインに使う OIDC クライアントと同じ ID / シークレットで叩く。
 * ChreeID 側でそのクライアントに `can_provision` を付けておかないと 403 になる。
 */

/** 応答を待つ時間。ログイン経路からも呼ぶので短くする */
const TIMEOUT_MS = 5000;

/** ChreeID から返ってきた応答 */
export interface ChreeIdResponse {
  status: number;
  data: Record<string, unknown>;
}

/**
 * ChreeID へのアカウント発行が使える設定か。
 * @returns ISSUER / ID / SECRET が揃っていれば true
 */
export function isChreeIdProvisioningEnabled(): boolean {
  return Boolean(process.env.AUTH_CHREEID_ISSUER && process.env.AUTH_CHREEID_ID && process.env.AUTH_CHREEID_SECRET);
}

/**
 * ModParks の利用者に対応する、ChreeID 上のサービスアカウントのパス。
 * @param userId ModParks 側の利用者ID
 */
export function serviceAccountPath(userId: string): string {
  return `/api/v1/service-accounts/${encodeURIComponent(userId)}`;
}

/**
 * ChreeID のサーバ間 API を呼ぶ。
 *
 * クライアント認証は Basic で送る。GET は本文を持てず、秘密をクエリに載せると
 * アクセスログに残るため。本文を持てるメソッドでは、Authorization を落とす
 * 中継に備えてフォーム値でも送る (ChreeID はどちらでも受け付ける)。
 *
 * @param method HTTP メソッド
 * @param path ChreeID 上のパス
 * @param params 送る値。GET では送らない
 * @throws Error ChreeID に到達できなかった
 */
export async function sendToChreeId(method: string, path: string, params: Record<string, string> = {}): Promise<ChreeIdResponse> {
  const issuer = process.env.AUTH_CHREEID_ISSUER!.replace(/\/+$/, "");
  const clientId = process.env.AUTH_CHREEID_ID!;
  const clientSecret = process.env.AUTH_CHREEID_SECRET!;

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (method !== "GET") {
    init.body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }).toString();
  }

  let res: Response;
  try {
    res = await fetch(issuer + path, init);
  } catch (e: unknown) {
    throw new Error(`ChreeID に到達できませんでした: ${method} ${path}`, { cause: e });
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data && typeof data === "object" ? data as Record<string, unknown> : {} };
}
