/**
 * 認可コードとアクセス／リフレッシュトークンの発行・検証。
 * 保存はすべてハッシュで、平文は発行時の戻り値でしか流通させない。
 */
import { getDatabase } from "@/lib/db";
import { oauthAccessTokens, oauthAuthCodes, oauthRefreshTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateSecret, sha256Hex } from "./crypto";
import { formatScope } from "./scopes";

export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

type GrantContext = {
  clientId: string;
  userId: string;
  scopes: readonly string[];
};

/** 認可コードを発行して平文を返す */
export async function issueAuthCode(params: GrantContext & {
  redirectUri: string;
  nonce: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: "S256" | null;
}): Promise<string> {
  const db = await getDatabase();
  const code = generateSecret("mpac");

  await db.insert(oauthAuthCodes).values({
    codeHash: await sha256Hex(code),
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    nonce: params.nonce,
    scope: formatScope(params.scopes),
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });

  return code;
}

/**
 * 認可コードを取り出して使用済みにする。
 * 既に使用済みだった場合は、そのコードから出たトークンを巻き添えで失効させたうえで null を返す。
 */
export async function consumeAuthCode(code: string) {
  const db = await getDatabase();
  const codeHash = await sha256Hex(code);
  const record = await db.select().from(oauthAuthCodes).where(eq(oauthAuthCodes.codeHash, codeHash)).get();
  if (!record) return null;

  if (record.usedAt) {
    await revokeClientTokens(record.userId, record.clientId);
    return null;
  }
  if (record.expiresAt.getTime() < Date.now()) return null;

  await db.update(oauthAuthCodes).set({ usedAt: new Date() }).where(eq(oauthAuthCodes.codeHash, codeHash));
  return record;
}

/** アクセストークンとリフレッシュトークンを対で発行する */
export async function issueTokens(ctx: GrantContext): Promise<IssuedTokens> {
  const db = await getDatabase();
  const accessToken = generateSecret("mpat");
  const refreshToken = generateSecret("mprt");
  const scope = formatScope(ctx.scopes);

  await db.insert(oauthAccessTokens).values({
    tokenHash: await sha256Hex(accessToken),
    clientId: ctx.clientId,
    userId: ctx.userId,
    scope,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
  });

  await db.insert(oauthRefreshTokens).values({
    tokenHash: await sha256Hex(refreshToken),
    clientId: ctx.clientId,
    userId: ctx.userId,
    scope,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000), scope };
}

/**
 * リフレッシュトークンを消費して新しい対を発行する（ローテーション）。
 * 使用済みトークンの再提示は盗用の可能性が高いため、その利用者×クライアントの
 * トークンを全部落として最初からやり直させる。
 */
export async function rotateRefreshToken(refreshToken: string, clientId: string) {
  const db = await getDatabase();
  const tokenHash = await sha256Hex(refreshToken);
  const record = await db.select().from(oauthRefreshTokens).where(eq(oauthRefreshTokens.tokenHash, tokenHash)).get();

  if (!record || record.clientId !== clientId) return null;
  if (record.revokedAt || record.replacedBy) {
    await revokeClientTokens(record.userId, record.clientId);
    return null;
  }
  if (record.expiresAt.getTime() < Date.now()) return null;

  const issued = await issueTokens({
    clientId: record.clientId,
    userId: record.userId,
    scopes: record.scope.split(" "),
  });

  await db.update(oauthRefreshTokens)
    .set({ revokedAt: new Date(), replacedBy: await sha256Hex(issued.refreshToken) })
    .where(eq(oauthRefreshTokens.tokenHash, tokenHash));

  return issued;
}

/** アクセストークンを検証し、有効なら所有者とスコープを返す */
export async function verifyAccessToken(token: string) {
  const db = await getDatabase();
  const tokenHash = await sha256Hex(token);
  const record = await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.tokenHash, tokenHash)).get();

  if (!record || record.revokedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  try {
    await db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, record.id));
  } catch {
    // 最終利用日時は監査用の付加情報でしかないため、失敗しても認証は通す
  }

  return { userId: record.userId, clientId: record.clientId, scopes: record.scope.split(" ") };
}

/** ユーザー×クライアントのトークンを一括失効させる（連携解除・盗用検知） */
export async function revokeClientTokens(userId: string, clientId: string) {
  const db = await getDatabase();
  const now = new Date();
  await db.update(oauthAccessTokens).set({ revokedAt: now })
    .where(and(eq(oauthAccessTokens.userId, userId), eq(oauthAccessTokens.clientId, clientId)));
  await db.update(oauthRefreshTokens).set({ revokedAt: now })
    .where(and(eq(oauthRefreshTokens.userId, userId), eq(oauthRefreshTokens.clientId, clientId)));
}

/**
 * RFC 7009 の revoke。トークン種別が不明でも動くよう両方のテーブルを当たる。
 * 該当が無くても呼び出し側には成功を返す仕様なので、ここでは黙って終わる。
 */
export async function revokeToken(token: string, clientId: string) {
  const db = await getDatabase();
  const tokenHash = await sha256Hex(token);
  const now = new Date();

  await db.update(oauthAccessTokens).set({ revokedAt: now })
    .where(and(eq(oauthAccessTokens.tokenHash, tokenHash), eq(oauthAccessTokens.clientId, clientId)));
  await db.update(oauthRefreshTokens).set({ revokedAt: now })
    .where(and(eq(oauthRefreshTokens.tokenHash, tokenHash), eq(oauthRefreshTokens.clientId, clientId)));
}
