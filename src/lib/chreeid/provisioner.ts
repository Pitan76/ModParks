import type { Database } from "@/lib/db";
import { accounts, users, userProfiles } from "@modparks/core/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { isChreeIdProvisioningEnabled, sendToChreeId, serviceAccountPath } from "./client";

/**
 * ModParks の利用者に ChreeID を用意して紐付ける。
 *
 * **ModParks のアカウントは特例として残す。** DokuFarm と違ってパスワード照合を
 * ChreeID へ寄せることはせず、ModParks のログイン手段はすべてそのまま使える。
 * ChreeID は「同じ人として入れるもう一つの入口」として足すだけ。
 *
 * 紐付けは NextAuth の `account` 表に `provider = "chreeid"` の行として持つ。
 * ChreeID でログインしたときと同じ形なので、発行後はそのまま ChreeID で入れる。
 */

/** NextAuth の ChreeID プロバイダID */
export const CHREEID_PROVIDER = "chreeid";

/** 外部IdPとして ChreeID に引き継ぐプロバイダ */
const EXTERNAL_PROVIDERS = ["google", "github"];

/**
 * 既に紐付いている ChreeID の sub。
 * @param db DB
 * @param userId ModParks 側の利用者ID
 * @returns 紐付いていなければ null
 */
export async function findChreeIdSub(db: Database, userId: string): Promise<string | null> {
  const row = await db.select({ sub: accounts.providerAccountId }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, CHREEID_PROVIDER))).get();
  return row?.sub ?? null;
}

/**
 * まだ ChreeID を持たない利用者に用意する。何度呼んでもよい。
 *
 * 失敗しても例外を投げない。ChreeID が落ちていても ModParks のログインは
 * 通さなければならない。次の機会にやり直せばよい。
 *
 * @param db DB
 * @param userId ModParks 側の利用者ID
 * @returns 紐付いている sub。用意できなければ null
 */
export async function ensureChreeId(db: Database, userId: string): Promise<string | null> {
  if (!isChreeIdProvisioningEnabled()) return null;

  try {
    const knownSub = await findChreeIdSub(db, userId);
    if (knownSub !== null) {
      const { status, data } = await sendToChreeId("GET", serviceAccountPath(userId));
      // 紐付けがあるなら触らない。ただし外部IdPを渡し損ねていたら足す
      if (status === 200 && !(await needsExternalBackfill(db, userId, data))) return knownSub;
      // 判断できないときも触らない。落ちているだけかもしれない
      if (status !== 200 && status !== 404) return knownSub;
    }

    const sub = await issue(db, userId, knownSub);
    if (sub === null) return null;

    await db.insert(accounts).values({
      userId,
      type: "oidc",
      provider: CHREEID_PROVIDER,
      providerAccountId: sub,
    }).onConflictDoNothing().run();
    return sub;
  } catch (e: unknown) {
    console.warn("[ChreeID] provision failed:", userId, e);
    return null;
  }
}

/**
 * 引き取り (claim) 画面への一度きりの URL を取りに行く。
 *
 * 本人がボタンを押したときにだけ呼ぶ。結果を見せる必要があるので失敗は投げる。
 *
 * @param db DB
 * @param userId ModParks 側の利用者ID
 * @returns 既に引き取り済みなら null
 * @throws Error 用意できない、または断られた
 */
export async function requestChreeIdClaimUrl(db: Database, userId: string): Promise<string | null> {
  if ((await ensureChreeId(db, userId)) === null) throw new Error("ChreeID のアカウントを用意できませんでした");

  const { status, data } = await sendToChreeId("POST", `${serviceAccountPath(userId)}/claim-tickets`);
  if (status === 409) return null;
  if (status !== 201 || typeof data.claim_url !== "string") throw new Error(`ChreeID が ${status} を返しました`);
  return data.claim_url;
}

/**
 * 本人が ChreeID を引き取り済みか。
 * @param userId ModParks 側の利用者ID
 * @returns 判断できなければ null
 */
export async function isChreeIdMigrated(userId: string): Promise<boolean | null> {
  if (!isChreeIdProvisioningEnabled()) return null;

  try {
    const { status, data } = await sendToChreeId("GET", serviceAccountPath(userId));
    if (status === 404) return false;
    if (status !== 200) return null;
    return data.migrated === true;
  } catch (e: unknown) {
    console.warn("[ChreeID] status check failed:", userId, e);
    return null;
  }
}

/**
 * 変更されたパスワードを ChreeID 側へ写す。
 *
 * ModParks の照合は ModParks で行うので、写し損ねても ModParks には影響しない。
 * 引き取り済み (409) なら ChreeID 側は本人のものなので触らない。
 *
 * @param userId ModParks 側の利用者ID
 * @param passwordHash 保存した bcrypt ハッシュ
 */
export async function syncChreeIdPassword(userId: string, passwordHash: string): Promise<void> {
  if (!isChreeIdProvisioningEnabled()) return;

  try {
    const { status } = await sendToChreeId("PUT", `${serviceAccountPath(userId)}/password`, { password_hash: passwordHash });
    if (status !== 204 && status !== 404 && status !== 409) console.warn("[ChreeID] password sync status:", userId, status);
  } catch (e: unknown) {
    console.warn("[ChreeID] password sync failed:", userId, e);
  }
}

/**
 * ModParks のアカウントが消えたときに呼ぶ。ChreeID 側はログインできない状態になる。
 * 退会そのものは止めたくないので、失敗しても投げない (孤児化するだけ)。
 *
 * @param userId ModParks 側の利用者ID
 */
export async function deactivateChreeId(userId: string): Promise<void> {
  if (!isChreeIdProvisioningEnabled()) return;

  try {
    await sendToChreeId("DELETE", serviceAccountPath(userId));
  } catch (e: unknown) {
    console.warn("[ChreeID] deactivate failed:", userId, e);
  }
}

/**
 * 発行のあとで Google などを繋いだ人は、ChreeID 側に外部IdPが渡っていない。
 * 移行の画面で選べるものが出ないので、気付いたときに足す。
 *
 * @param db DB
 * @param userId ModParks 側の利用者ID
 * @param status 状態照会の応答
 */
async function needsExternalBackfill(db: Database, userId: string, status: Record<string, unknown>): Promise<boolean> {
  const types = status.credential_types;
  if (!Array.isArray(types) || types.includes("oauth")) return false;
  return (await externalIdentities(db, userId)).length > 0;
}

/**
 * ChreeID にアカウントを要求する。
 *
 * パスワードは平文を送らない。ModParks も bcrypt なので、保存済みのハッシュを
 * そのまま渡せば向こうの password_verify でも照合できる。
 *
 * @param db DB
 * @param userId ModParks 側の利用者ID
 * @param knownSub 既に分かっている sub。紐付けだけ作り直したいときに渡す
 * @returns 受け取った sub。利用者が居なければ null
 */
async function issue(db: Database, userId: string, knownSub: string | null): Promise<string | null> {
  const record = await db.select().from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, userId)).get();
  if (!record?.users || record.users.deletedAt) return null;

  const user = record.users;
  const params: Record<string, string> = { display_name: record.user_profiles?.displayName ?? user.name ?? "" };

  if (user.email) {
    params.email = user.email;
    params.email_verified = user.emailVerified ? "1" : "0";
    // メールリンクでのログインを ModParks でも使えるので、向こうでも使えるようにする
    if (user.emailVerified) params.magic_link = "1";
  }
  if (user.passwordHash) params.password_hash = user.passwordHash;
  if (knownSub !== null) params.sub = knownSub;

  const external = await externalIdentities(db, userId);
  external.forEach((identity, i) => { params[`external[${i}]`] = identity; });

  const { status, data } = await sendToChreeId("PUT", serviceAccountPath(userId), params);
  if (status !== 200) throw new Error(`ChreeID が ${status} を返しました`);
  return typeof data.sub === "string" ? data.sub : null;
}

/**
 * この利用者が使っている外部IdPの連携。"google:123456" の形で渡す。
 *
 * **パスワードだけを渡していると、Google や GitHub だけで使っていた人の
 * ChreeID に認証手段が1つも付かない。**
 *
 * @param db DB
 * @param userId ModParks 側の利用者ID
 */
async function externalIdentities(db: Database, userId: string): Promise<string[]> {
  const rows = await db.select({ provider: accounts.provider, id: accounts.providerAccountId }).from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.provider, EXTERNAL_PROVIDERS))).all();
  return rows.map((row) => `${row.provider}:${row.id}`);
}
