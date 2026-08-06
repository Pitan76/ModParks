/**
 * OAuth クライアントの参照と認証。
 */
import { getDatabase } from "@/lib/db";
import { oauthClients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSecret, sha256Hex } from "./crypto";
import type { OAuthClient } from "@/db/schema";

/** client_id の接頭辞。ログや設定ファイルで一目で判別できるようにする */
const CLIENT_ID_PREFIX = "mpc";
const CLIENT_SECRET_PREFIX = "mpcs";

export function generateClientId(): string {
  return generateSecret(CLIENT_ID_PREFIX);
}

export function generateClientSecret(): string {
  return generateSecret(CLIENT_SECRET_PREFIX);
}

export async function findClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const db = await getDatabase();
  const client = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).get();
  if (!client || client.disabledAt) return null;
  return client;
}

/**
 * redirect_uri は完全一致でのみ許可する。
 * 前方一致を許すとオープンリダイレクタ経由で認可コードを奪われる。
 */
export function isAllowedRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

/**
 * トークンエンドポイントのクライアント認証。
 * confidential なら client_secret が必須、public は client_id の一致のみ（PKCE で担保）。
 */
export async function authenticateClient(client: OAuthClient, secret: string | null): Promise<boolean> {
  if (!client.isConfidential) return true;
  if (!secret || !client.secretHash) return false;
  return (await sha256Hex(secret)) === client.secretHash;
}

/**
 * Authorization ヘッダ（client_secret_basic）とボディ（client_secret_post）の
 * どちらの形式でもクライアント資格情報を取り出す。
 */
export function readClientCredentials(request: Request, form: URLSearchParams) {
  const header = request.headers.get("Authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    if (sep < 0) return { clientId: "", clientSecret: null };
    return {
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  }
  return {
    clientId: form.get("client_id") ?? "",
    clientSecret: form.get("client_secret"),
  };
}
