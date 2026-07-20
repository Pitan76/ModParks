/**
 * マージ復元。
 *
 * 全置換の復元と違い、現行DBを残したままバックアップの内容を取り込みます。
 * テーブルごとの衝突解決方針は mergePolicy.ts が定義します。
 *
 * 「バックアップ後に削除された行」を復活させないため、墓標 (deleted_records) を
 * 参照します。墓標が無い状態でマージすると、削除済みのデータが戻ります。
 */
import { and, eq } from "drizzle-orm";
import {
  SCHEMA_TABLES,
  TABLE_PRIMARY_KEYS,
  TABLE_RESTORE_ORDER,
  reviveRows,
  loadBackupTables,
} from "@/lib/backup/core";
import { MERGE_POLICIES } from "@/lib/backup/mergePolicy";
import { getTombstonedKeys, recordKeyFromRow } from "@/lib/backup/tombstone";

/** テーブル1つ分のマージ結果の内訳 */
export interface TableMergeSummary {
  table: string;
  strategy: string;
  /** 現行DBに存在しないので新規挿入する行数 */
  inserts: number;
  /** updatedAt がバックアップ側の方が新しいので上書きする行数 */
  updates: number;
  /** 既に現行DBに同じ主キーが存在し、変更不要と判断した行数 */
  unchanged: number;
  /** 墓標に載っているため復活させなかった行数 */
  suppressedByTombstone: number;
  /** manual 戦略のため自動適用せず、管理者の判断に回した行数 */
  needsReview: number;
}

export interface MergePlan {
  summaries: TableMergeSummary[];
  totals: { inserts: number; updates: number; suppressedByTombstone: number; needsReview: number };
  /** manual 戦略のテーブルで検出した差分の詳細（先頭のみ。UI 表示用） */
  reviewSamples: { table: string; recordKey: string; reason: "missing" | "differs" }[];
}

/** 実際に適用する操作。プラン算出と適用で同じ構造を使います。 */
interface MergeOperations {
  inserts: { table: string; rows: Record<string, any>[] }[];
  updates: { table: string; rows: Record<string, any>[] }[];
}

/** updatedAt を持つ行かどうかを判定し、比較可能な数値を返します。 */
function updatedAtValue(row: Record<string, any>): number | null {
  const raw = row.updatedAt;
  if (raw === null || raw === undefined) return null;
  const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * バックアップの内容と現行DBを突き合わせ、適用すべき操作とその要約を算出します。
 * この関数はDBを変更しません。
 */
async function computeMerge(
  db: any,
  tables: Record<string, any[]>
): Promise<{ plan: MergePlan; operations: MergeOperations }> {
  const summaries: TableMergeSummary[] = [];
  const reviewSamples: MergePlan["reviewSamples"] = [];
  const operations: MergeOperations = { inserts: [], updates: [] };

  // 親テーブルを先に処理する。挿入順が外部キー制約を満たす必要があるため。
  for (const table of TABLE_RESTORE_ORDER) {
    const policy = MERGE_POLICIES[table];
    const tableObj = SCHEMA_TABLES[table];
    const backupRows = tables[table];

    if (!policy || !tableObj || !backupRows || backupRows.length === 0) continue;
    if (policy.strategy === "skip") continue;

    const pkColumns = TABLE_PRIMARY_KEYS[table];
    if (!pkColumns) throw new Error(`No primary key definition for table: ${table}`);

    // 現行DBの主キー（と LWW 判定用の updatedAt）だけを引く。全列は不要。
    const selection: Record<string, any> = {};
    for (const col of pkColumns) selection[col] = tableObj[col];
    const hasUpdatedAt = Boolean(tableObj.updatedAt);
    if (hasUpdatedAt) selection.updatedAt = tableObj.updatedAt;

    const currentRows = await db.select(selection).from(tableObj).all();
    const currentByKey = new Map<string, Record<string, any>>(
      currentRows.map((row: Record<string, any>) => [recordKeyFromRow(table, row), row])
    );

    const tombstoned = await getTombstonedKeys(db, table);

    const summary: TableMergeSummary = {
      table,
      strategy: policy.strategy,
      inserts: 0,
      updates: 0,
      unchanged: 0,
      suppressedByTombstone: 0,
      needsReview: 0,
    };

    const rowsToInsert: Record<string, any>[] = [];
    const rowsToUpdate: Record<string, any>[] = [];

    for (const row of backupRows) {
      const key = recordKeyFromRow(table, row);
      const existing = currentByKey.get(key);

      if (!existing) {
        // 現行DBに無い行。削除された結果なら復活させてはいけない。
        if (tombstoned.has(key)) {
          summary.suppressedByTombstone++;
          continue;
        }
        if (policy.strategy === "manual") {
          summary.needsReview++;
          if (reviewSamples.length < 50) reviewSamples.push({ table, recordKey: key, reason: "missing" });
          continue;
        }
        rowsToInsert.push(row);
        summary.inserts++;
        continue;
      }

      // 主キーが衝突している場合
      if (policy.strategy === "manual") {
        summary.needsReview++;
        if (reviewSamples.length < 50) reviewSamples.push({ table, recordKey: key, reason: "differs" });
        continue;
      }

      if (policy.strategy === "last_write_wins" && hasUpdatedAt) {
        const backupTime = updatedAtValue(row);
        const currentTime = updatedAtValue(existing);
        // 判定できない場合は現行DBを優先する（安全側に倒す）
        if (backupTime !== null && currentTime !== null && backupTime > currentTime) {
          rowsToUpdate.push(row);
          summary.updates++;
          continue;
        }
      }

      summary.unchanged++;
    }

    if (rowsToInsert.length > 0) {
      operations.inserts.push({ table, rows: reviveRows(tableObj, rowsToInsert) });
    }
    if (rowsToUpdate.length > 0) {
      operations.updates.push({ table, rows: reviveRows(tableObj, rowsToUpdate) });
    }

    summaries.push(summary);
  }

  const totals = summaries.reduce(
    (acc, s) => ({
      inserts: acc.inserts + s.inserts,
      updates: acc.updates + s.updates,
      suppressedByTombstone: acc.suppressedByTombstone + s.suppressedByTombstone,
      needsReview: acc.needsReview + s.needsReview,
    }),
    { inserts: 0, updates: 0, suppressedByTombstone: 0, needsReview: 0 }
  );

  return { plan: { summaries, totals, reviewSamples }, operations };
}

/**
 * マージ内容を試算します（DBは変更しません）。
 * 管理者に確認させるための要約を返します。
 */
export async function planMerge(db: any, payload: unknown): Promise<MergePlan> {
  const tables = await loadBackupTables(payload);
  const { plan } = await computeMerge(db, tables);
  return plan;
}

/** 主キーの一致条件を組み立てます。 */
function primaryKeyCondition(tableObj: any, table: string, row: Record<string, any>) {
  const pkColumns = TABLE_PRIMARY_KEYS[table];
  const conditions = pkColumns.map((col) => eq(tableObj[col], row[col]));
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

/**
 * マージを実行します。
 *
 * 適用直前にプランを再計算するため、確認画面を表示している間に
 * 現行DBが変化していた場合もその時点の状態に基づいて適用されます。
 * 実際に適用した件数を返すので、確認時の要約と突き合わせられます。
 */
export async function applyMerge(db: any, payload: unknown): Promise<MergePlan> {
  const tables = await loadBackupTables(payload);
  const { plan, operations } = await computeMerge(db, tables);

  const statements: any[] = [];

  // 挿入は親テーブルから。computeMerge が TABLE_RESTORE_ORDER 順に積んでいる。
  for (const { table, rows } of operations.inserts) {
    const tableObj = SCHEMA_TABLES[table];
    for (const chunk of chunkForD1(rows)) {
      statements.push(db.insert(tableObj).values(chunk));
    }
  }

  // 更新は1行ずつ。主キーが複合のテーブルもあるためまとめられない。
  for (const { table, rows } of operations.updates) {
    const tableObj = SCHEMA_TABLES[table];
    for (const row of rows) {
      statements.push(db.update(tableObj).set(row).where(primaryKeyCondition(tableObj, table, row)));
    }
  }

  if (statements.length === 0) return plan;

  // D1 の batch は単一トランザクションだが、1回に積める量に上限がある。
  // 全体を1バッチに収められない場合は分割するため、途中で失敗すると
  // 部分適用になりうる。呼び出し側が事前にスナップショットを取ること。
  for (const group of chunkStatements(statements, BATCH_STATEMENT_LIMIT)) {
    await db.batch(group as [any, ...any[]]);
  }

  return plan;
}

/** D1 の 1 バッチあたりのステートメント数の上限（安全側の値） */
const BATCH_STATEMENT_LIMIT = 50;

const D1_MAX_BOUND_PARAMS = 100;

/** バインドパラメータ上限を超えないよう、列数から挿入チャンクを決めます。 */
function chunkForD1(rows: Record<string, any>[]): Record<string, any>[][] {
  const columnCount = Math.max(1, Object.keys(rows[0]).length);
  const size = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnCount));
  const chunks: Record<string, any>[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function chunkStatements<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
