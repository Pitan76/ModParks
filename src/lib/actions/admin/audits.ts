"use server";

import { desc, sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/auth-helpers";
import { settingsAudit, backupAudit, ddosAudit } from "@/db/schema";

type AuditTable = typeof settingsAudit | typeof backupAudit | typeof ddosAudit;

export interface AuditPage<TLog> {
  logs: TLog[];
  total: number;
}

/**
 * 監査ログを新しい順に1ページ分と総件数を返す。
 * 対象テーブルが違うだけで手順は同一なので、各アクションはこれを呼ぶだけにしている。
 */
async function fetchAuditPage<TTable extends AuditTable>(
  table: TTable,
  limit: number,
  offset: number,
): Promise<AuditPage<TTable["$inferSelect"]>> {
  const { db } = await getAdminDb();

  const logs = await db
    .select()
    .from(table)
    .orderBy(desc(table.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(table)
    .get();

  return { logs: logs as TTable["$inferSelect"][], total: countRes?.count ?? 0 };
}

/** 設定変更の監査ログ */
export async function getSettingsAudits(limit = 50, offset = 0) {
  return fetchAuditPage(settingsAudit, limit, offset);
}

/** バックアップ実行の監査ログ */
export async function getBackupAudits(limit = 50, offset = 0) {
  return fetchAuditPage(backupAudit, limit, offset);
}

/** DDoS防御の状態遷移の監査ログ */
export async function getDdosAudits(limit = 50, offset = 0) {
  return fetchAuditPage(ddosAudit, limit, offset);
}
