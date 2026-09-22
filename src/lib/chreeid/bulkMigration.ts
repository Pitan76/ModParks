import type { Database } from "@/lib/db";
import { accounts, users } from "@modparks/core/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { CHREEID_PROVIDER, ensureChreeId } from "./provisioner";

/**
 * ChreeID への一括発行。
 *
 * ログイン時の発行だけだと、来ない人はいつまでも ChreeID を持たない。
 * 待つのではなく、管理画面からこちらで発行し切る。`ensureChreeId()` は冪等なので何度流してもよい。
 */

/** 1回で処理する人数。Workers の実行時間に収まるよう区切る */
export const CHREEID_BATCH_SIZE = 25;

/** 一括発行の結果 */
export interface ChreeIdRunResult {
  done: number;
  failed: number;
  remaining: number;
  failures: string[];
}

/** 洗い直しの結果。全員が対象なので、どこまで見たかを持ち回る */
export interface ChreeIdResyncResult {
  checked: number;
  failed: number;
  next: number | null;
  total: number;
  failures: string[];
}

/**
 * 退会していない利用者と、ChreeID の紐付けの有無。
 * @param db DB
 */
async function listUsers(db: Database) {
  return db.select({ id: users.id, email: users.email, sub: accounts.providerAccountId })
    .from(users)
    .leftJoin(accounts, and(eq(accounts.userId, users.id), eq(accounts.provider, CHREEID_PROVIDER)))
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.createdAt), asc(users.id))
    .all();
}

/**
 * まだ ChreeID を持っていない人を数える。
 * @param db DB
 */
export async function countChreeIdPending(db: Database): Promise<{ total: number; pending: number }> {
  const rows = await listUsers(db);
  return { total: rows.length, pending: rows.filter((row) => row.sub === null).length };
}

/**
 * 未発行の人を、指定した人数だけ発行する。
 * @param db DB
 * @param limit 1回で処理する人数
 */
export async function runChreeIdMigration(db: Database, limit = CHREEID_BATCH_SIZE): Promise<ChreeIdRunResult> {
  const pending = (await listUsers(db)).filter((row) => row.sub === null);
  const batch = pending.slice(0, limit);
  const failures: string[] = [];

  for (const user of batch) {
    if ((await ensureChreeId(db, user.id)) === null) failures.push(`${user.id} ${user.email ?? "-"}`);
  }

  return {
    done: batch.length - failures.length,
    failed: failures.length,
    remaining: pending.length - batch.length,
    failures,
  };
}

/**
 * 既に紐付いている人も含めて ChreeID 側を洗い直す。
 * 引き継ぎの仕組みを直したあと、渡し損ねていた外部IdPを足すのに使う。
 *
 * @param db DB
 * @param offset 何人目から見るか
 * @param limit 1回で確かめる人数
 */
export async function resyncChreeId(db: Database, offset = 0, limit = CHREEID_BATCH_SIZE): Promise<ChreeIdResyncResult> {
  const all = await listUsers(db);
  const slice = all.slice(Math.max(0, offset), Math.max(0, offset) + limit);
  const failures: string[] = [];

  for (const user of slice) {
    if ((await ensureChreeId(db, user.id)) === null) failures.push(`${user.id} ${user.email ?? "-"}`);
  }

  const next = Math.max(0, offset) + slice.length;
  return {
    checked: slice.length - failures.length,
    failed: failures.length,
    next: next < all.length ? next : null,
    total: all.length,
    failures,
  };
}
