/**
 * 設定画面「OAuthアプリ」が使う一覧取得。
 */
import { getDatabase } from "@/lib/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { eq } from "drizzle-orm";

export type OwnedOAuthApp = {
  id: string;
  name: string;
  description: string | null;
  homepageUrl: string | null;
  logoUrl: string | null;
  redirectUris: string[];
  scopes: string[];
  isConfidential: boolean;
  createdAt: Date;
};

export type ConnectedOAuthApp = {
  clientId: string;
  name: string;
  logoUrl: string | null;
  homepageUrl: string | null;
  scopes: string[];
  authorizedAt: Date;
};

/** 自分が登録した（＝他サービス側の）アプリ */
export async function getOwnedOAuthApps(userId: string): Promise<OwnedOAuthApp[]> {
  const db = await getDatabase();
  const rows = await db.select().from(oauthClients).where(eq(oauthClients.ownerUserId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    homepageUrl: row.homepageUrl,
    logoUrl: row.logoUrl,
    redirectUris: row.redirectUris,
    scopes: row.scopes.split(" "),
    isConfidential: row.isConfidential,
    createdAt: row.createdAt,
  }));
}

/** 自分のアカウントへのアクセスを許可しているアプリ */
export async function getConnectedOAuthApps(userId: string): Promise<ConnectedOAuthApp[]> {
  const db = await getDatabase();
  const rows = await db
    .select({
      clientId: oauthClients.id,
      name: oauthClients.name,
      logoUrl: oauthClients.logoUrl,
      homepageUrl: oauthClients.homepageUrl,
      scope: oauthGrants.scope,
      updatedAt: oauthGrants.updatedAt,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .where(eq(oauthGrants.userId, userId));

  return rows.map((row) => ({
    clientId: row.clientId,
    name: row.name,
    logoUrl: row.logoUrl,
    homepageUrl: row.homepageUrl,
    scopes: row.scope.split(" "),
    authorizedAt: row.updatedAt,
  }));
}
