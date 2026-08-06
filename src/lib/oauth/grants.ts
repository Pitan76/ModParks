/**
 * ユーザーの同意（grant）の記録と参照。
 */
import { getDatabase } from "@/lib/db";
import { oauthGrants } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { formatScope, isSubsetOf } from "./scopes";

/** 既存同意が要求スコープを満たしていれば、同意画面を出さずに済ませられる */
export async function findCoveringGrant(userId: string, clientId: string, scopes: readonly string[]) {
  const db = await getDatabase();
  const grant = await db.select().from(oauthGrants)
    .where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.clientId, clientId)))
    .get();

  if (!grant) return null;
  if (!isSubsetOf(scopes, grant.scope.split(" "))) return null;
  return grant;
}

/**
 * 同意を保存する。再同意では既存スコープとの和集合にして、
 * 追加スコープを承認したあとに前の権限が消えないようにする。
 */
export async function saveGrant(userId: string, clientId: string, scopes: readonly string[]) {
  const db = await getDatabase();
  const existing = await db.select().from(oauthGrants)
    .where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.clientId, clientId)))
    .get();

  const merged = formatScope([...new Set([...(existing?.scope.split(" ") ?? []), ...scopes])]);

  if (!existing) {
    await db.insert(oauthGrants).values({ userId, clientId, scope: merged });
    return merged;
  }

  await db.update(oauthGrants)
    .set({ scope: merged, updatedAt: new Date() })
    .where(eq(oauthGrants.id, existing.id));
  return merged;
}

export async function deleteGrant(userId: string, clientId: string) {
  const db = await getDatabase();
  await db.delete(oauthGrants).where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.clientId, clientId)));
}
