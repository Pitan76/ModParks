/**
 * ポイント台帳。
 *
 * point_transactions は追記専用で、UPDATE / DELETE しない。
 * 訂正は逆仕訳 (adjustment) を足して表現する。
 * point_accounts.balance は台帳から再構築できる参照用のキャッシュで、
 * 必ず取引の記録と同じ batch で更新する。
 */
import { eq, desc, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { pointAccounts, pointTransactions, type PointTransaction } from "@/db/schema";

export type PointTransactionType = PointTransaction["type"];

export type RecordPointsInput = {
  userId: string;
  /** 正 = 付与 / 負 = 消費 */
  amount: number;
  type: PointTransactionType;
  /** 同じキーの取引は 1 度しか記録されない。バッチ再実行の二重付与を防ぐ */
  idempotencyKey: string;
  reason?: string;
  periodId?: string;
  payoutRequestId?: string;
};

export type PointBalance = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

const EMPTY_BALANCE: PointBalance = { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };

/** 残高を返す。口座が未作成のユーザーはゼロ残高として扱う */
export async function getPointBalance(userId: string): Promise<PointBalance> {
  const db = await getDatabase();
  const account = await db
    .select()
    .from(pointAccounts)
    .where(eq(pointAccounts.userId, userId))
    .get();

  if (!account) return EMPTY_BALANCE;

  return {
    balance: account.balance,
    lifetimeEarned: account.lifetimeEarned,
    lifetimeSpent: account.lifetimeSpent,
  };
}

/** 取引履歴を新しい順に返す */
export async function listPointTransactions(userId: string, limit = 50): Promise<PointTransaction[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit)
    .all();
}

/**
 * 取引を記録し、残高へ反映する。
 *
 * idempotencyKey が既に存在する場合は何もせず false を返すため、
 * 月次バッチや Webhook からの再実行が安全に行える。
 */
export async function recordPointTransaction(input: RecordPointsInput): Promise<boolean> {
  if (input.amount === 0) throw new Error("point transaction amount must not be zero");

  const db = await getDatabase();
  const existing = await db
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(eq(pointTransactions.idempotencyKey, input.idempotencyKey))
    .get();

  if (existing) return false;

  const earned = input.amount > 0 ? input.amount : 0;
  const spent = input.amount < 0 ? -input.amount : 0;

  await db.batch([
    db.insert(pointTransactions).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      periodId: input.periodId ?? null,
      payoutRequestId: input.payoutRequestId ?? null,
      reason: input.reason ?? null,
      idempotencyKey: input.idempotencyKey,
    }),
    db
      .insert(pointAccounts)
      .values({
        userId: input.userId,
        balance: input.amount,
        lifetimeEarned: earned,
        lifetimeSpent: spent,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pointAccounts.userId,
        set: {
          balance: sql`${pointAccounts.balance} + ${input.amount}`,
          lifetimeEarned: sql`${pointAccounts.lifetimeEarned} + ${earned}`,
          lifetimeSpent: sql`${pointAccounts.lifetimeSpent} + ${spent}`,
          updatedAt: new Date(),
        },
      }),
  ]);

  return true;
}

/**
 * 台帳の合計と残高キャッシュのズレを検出する。
 *
 * ここがズレたまま出金を通すと、払えない残高を払い出すことになるため、
 * 定期実行して不一致が出たら分配・出金を止める。
 */
export async function findBalanceMismatches(): Promise<
  { userId: string; cached: number; ledger: number }[]
> {
  const db = await getDatabase();
  const rows = await db
    .select({
      userId: pointAccounts.userId,
      cached: pointAccounts.balance,
      ledger: sql<number>`coalesce((
        select sum(amount) from point_transactions t where t.user_id = ${pointAccounts.userId}
      ), 0)`,
    })
    .from(pointAccounts)
    .all();

  return rows.filter((r) => r.cached !== r.ledger);
}
