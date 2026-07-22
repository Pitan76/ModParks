import { getTableColumns } from "drizzle-orm";
import { SCHEMA_TABLES, TABLE_RESTORE_ORDER } from "./schemaConfig";

export const SUPPORTED_BACKUP_VERSIONS = ["1.0"];
const D1_MAX_BOUND_PARAMS = 100;

/**
 * バックアップペイロードの形式を検証します。
 */
export const validateBackupPayload = (payload: unknown): Record<string, any> => {
  const p = payload as { version?: string; tables?: Record<string, any> } | null;

  if (!p || typeof p !== "object" || !p.tables) {
    throw new Error("Invalid backup file format");
  }
  if (!p.version || !SUPPORTED_BACKUP_VERSIONS.includes(p.version)) {
    throw new Error(
      `Unsupported backup version: ${p.version ?? "(none)"}. Supported: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}`
    );
  }

  const unknownTables = Object.keys(p.tables).filter((t) => !SCHEMA_TABLES[t]);
  if (unknownTables.length > 0) {
    throw new Error(`Backup contains tables unknown to the current schema: ${unknownTables.join(", ")}`);
  }

  return p.tables;
};

/**
 * バックアップを検証し、暗号化されたテーブルを復号して使える形にします。
 */
export const loadBackupTables = async (payload: unknown): Promise<Record<string, any[]>> => {
  const rawTables = validateBackupPayload(payload);
  const { isEncryptedEnvelope, decryptJson } = await import("@/lib/backup/crypto");

  const tables: Record<string, any[]> = {};
  for (const [name, value] of Object.entries(rawTables)) {
    if (isEncryptedEnvelope(value)) {
      tables[name] = (await decryptJson(value)) as any[];
    } else if (Array.isArray(value)) {
      tables[name] = value;
    } else {
      throw new Error(`Unexpected data shape for table: ${name}`);
    }
  }

  return tables;
};

/**
 * JSON から読み戻した行を、drizzle が受け付ける型に復元します。
 */
export const reviveRows = (tableObj: any, rows: Record<string, any>[]): Record<string, any>[] => {
  const columns = getTableColumns(tableObj);

  const timestampColumns = Object.entries(columns)
    .filter(([, col]: [string, any]) => col?.constructor?.name === "SQLiteTimestamp")
    .map(([name]) => name);

  if (timestampColumns.length === 0) return rows;

  return rows.map((row) => {
    const revived = { ...row };
    for (const name of timestampColumns) {
      const value = row[name];
      if (value !== null && value !== undefined && !(value instanceof Date)) {
        revived[name] = new Date(value);
      }
    }
    return revived;
  });
};

/**
 * 行データを、D1 のバインドパラメータ上限を超えないチャンクに分割します。
 */
const chunkRows = (rows: any[]): any[][] => {
  const columnCount = Math.max(1, Object.keys(rows[0]).length);
  const chunkSize = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnCount));

  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * 指定されたテーブルデータを用いてデータベースをリストアします。
 */
export const importBackupData = async (db: any, tablesData: Record<string, any[]>) => {
  const statements: any[] = [];

  for (const tableName of [...TABLE_RESTORE_ORDER].reverse()) {
    const tableObj = SCHEMA_TABLES[tableName];
    if (tableObj) statements.push(db.delete(tableObj));
  }

  for (const tableName of TABLE_RESTORE_ORDER) {
    const tableObj = SCHEMA_TABLES[tableName];
    const rows = tablesData[tableName];
    if (tableObj && rows && rows.length > 0) {
      for (const chunk of chunkRows(reviveRows(tableObj, rows))) {
        statements.push(db.insert(tableObj).values(chunk));
      }
    }
  }

  if (statements.length === 0) return;

  await db.batch(statements as [any, ...any[]]);
};
