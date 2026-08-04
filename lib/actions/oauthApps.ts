"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { oauthClients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { generateClientId, generateClientSecret } from "@/lib/oauth/clients";
import { sha256Hex } from "@/lib/oauth/crypto";
import { DEFAULT_CLIENT_SCOPES, isOAuthScope, formatScope } from "@/lib/oauth/scopes";
import { deleteGrant } from "@/lib/oauth/grants";
import { revokeClientTokens } from "@/lib/oauth/tokens";

const SETTINGS_PATH = "/settings/oauth-apps";

export type OAuthAppInput = {
  name: string;
  description: string;
  homepageUrl: string;
  logoUrl: string;
  redirectUris: string[];
  scopes: string[];
  isConfidential: boolean;
};

type ActionError = { success: false; error: string };

/** http は localhost の開発用途に限る。それ以外で平文に飛ばすと認可コードが盗まれる */
function validateRedirectUris(uris: string[]): string[] | null {
  if (uris.length === 0) return null;
  const cleaned: string[] = [];
  for (const raw of uris) {
    const value = raw.trim();
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    if (url.hash) return null;
    cleaned.push(value);
  }
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeScopes(scopes: string[]): string[] {
  const valid = scopes.filter(isOAuthScope);
  return valid.length > 0 ? [...new Set(valid)] : [...DEFAULT_CLIENT_SCOPES];
}

/**
 * OAuth アプリを登録する。client_secret は confidential のときだけ発行し、
 * 平文はこの戻り値でしか返さない。
 */
export async function createOAuthApp(input: OAuthAppInput) {
  const { db, userId } = await getAuthenticatedDb();

  const redirectUris = validateRedirectUris(input.redirectUris);
  if (!redirectUris) return { success: false, error: "invalidRedirectUri" } as ActionError;
  if (!input.name.trim()) return { success: false, error: "nameRequired" } as ActionError;

  const clientId = generateClientId();
  const clientSecret = input.isConfidential ? generateClientSecret() : null;

  await db.insert(oauthClients).values({
    id: clientId,
    secretHash: clientSecret ? await sha256Hex(clientSecret) : null,
    name: input.name.trim(),
    description: input.description.trim() || null,
    homepageUrl: input.homepageUrl.trim() || null,
    logoUrl: input.logoUrl.trim() || null,
    ownerUserId: userId,
    redirectUris,
    scopes: formatScope(normalizeScopes(input.scopes)),
    isConfidential: input.isConfidential,
  });

  revalidatePath(SETTINGS_PATH);
  return { success: true as const, clientId, clientSecret };
}

export async function updateOAuthApp(clientId: string, input: OAuthAppInput) {
  const { db, userId } = await getAuthenticatedDb();

  const redirectUris = validateRedirectUris(input.redirectUris);
  if (!redirectUris) return { success: false, error: "invalidRedirectUri" } as ActionError;
  if (!input.name.trim()) return { success: false, error: "nameRequired" } as ActionError;

  await db.update(oauthClients).set({
    name: input.name.trim(),
    description: input.description.trim() || null,
    homepageUrl: input.homepageUrl.trim() || null,
    logoUrl: input.logoUrl.trim() || null,
    redirectUris,
    scopes: formatScope(normalizeScopes(input.scopes)),
  }).where(and(eq(oauthClients.id, clientId), eq(oauthClients.ownerUserId, userId)));

  revalidatePath(SETTINGS_PATH);
  return { success: true as const };
}

/**
 * シークレットを再発行する。旧シークレットは即座に使えなくなる。
 */
export async function regenerateOAuthAppSecret(clientId: string) {
  const { db, userId } = await getAuthenticatedDb();

  const client = await db.select().from(oauthClients)
    .where(and(eq(oauthClients.id, clientId), eq(oauthClients.ownerUserId, userId)))
    .get();
  if (!client) return { success: false, error: "notFound" } as ActionError;
  if (!client.isConfidential) return { success: false, error: "publicClient" } as ActionError;

  const clientSecret = generateClientSecret();
  await db.update(oauthClients)
    .set({ secretHash: await sha256Hex(clientSecret) })
    .where(eq(oauthClients.id, clientId));

  revalidatePath(SETTINGS_PATH);
  return { success: true as const, clientSecret };
}

export async function deleteOAuthApp(clientId: string) {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(oauthClients).where(and(eq(oauthClients.id, clientId), eq(oauthClients.ownerUserId, userId)));
  await recordDeletion(db, "oauth_clients", clientId);

  revalidatePath(SETTINGS_PATH);
  return { success: true as const };
}

/**
 * 連携中アプリの解除。同意を消すだけでは発行済みトークンが生き残るため、合わせて失効させる。
 */
export async function revokeOAuthConnection(clientId: string) {
  const { userId } = await getAuthenticatedDb();

  await revokeClientTokens(userId, clientId);
  await deleteGrant(userId, clientId);

  revalidatePath(SETTINGS_PATH);
  return { success: true as const };
}
