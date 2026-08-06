import { getTableColumns, eq } from "drizzle-orm";
import { SCHEMA_TABLES, TABLE_RESTORE_ORDER } from "./schemaConfig";
import type { Database } from "@/lib/db";

export const SUPPORTED_BACKUP_VERSIONS = ["1.0"];
const D1_MAX_BOUND_PARAMS = 100;

export type RestoreOptions = {
  mode?: "all" | "downloads_only" | "selected_tables";
  selectedTables?: string[];
};

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
    throw new Error("Backup contains tables unknown to the current schema: " + unknownTables.join(", "));
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
export const importBackupData = async (
  db: Database,
  tablesData: Record<string, any[]>,
  options?: RestoreOptions
) => {
  const mode = options?.mode ?? "all";
  const statements: any[] = [];

  if (mode === "downloads_only") {
    // downloads_only: We only update download counts of projects and versions based on ID
    if (tablesData.projects && SCHEMA_TABLES.projects) {
      for (const row of tablesData.projects) {
        if (row.id !== undefined) {
          statements.push(
            db.update(SCHEMA_TABLES.projects)
              .set({
                downloads: row.downloads ?? 0,
                totalDownloads: row.totalDownloads ?? 0,
              })
              .where(eq(SCHEMA_TABLES.projects.id, row.id))
          );
        }
      }
    }

    if (tablesData.versions && SCHEMA_TABLES.versions) {
      for (const row of tablesData.versions) {
        if (row.id !== undefined) {
          statements.push(
            db.update(SCHEMA_TABLES.versions)
              .set({
                downloads: row.downloads ?? 0,
              })
              .where(eq(SCHEMA_TABLES.versions.id, row.id))
          );
        }
      }
    }
  } else if (mode === "selected_tables") {
    // selected_tables: Delete and insert only for selected tables
    const selected = options?.selectedTables ?? [];

    for (const tableName of [...TABLE_RESTORE_ORDER].reverse()) {
      if (selected.includes(tableName)) {
        const tableObj = SCHEMA_TABLES[tableName];
        if (tableObj) statements.push(db.delete(tableObj));
      }
    }

    for (const tableName of TABLE_RESTORE_ORDER) {
      if (selected.includes(tableName)) {
        const tableObj = SCHEMA_TABLES[tableName];
        const rows = tablesData[tableName];
        if (tableObj && rows && rows.length > 0) {
          for (const chunk of chunkRows(reviveRows(tableObj, rows))) {
            statements.push(db.insert(tableObj).values(chunk));
          }
        }
      }
    }
  } else {
    // mode === "all": Original full restore behavior
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
  }

  if (statements.length === 0) return;

  // Batch execute statements in chunks of 100 to avoid D1 request limitations
  const batchSize = 100;
  for (let i = 0; i < statements.length; i += batchSize) {
    const chunk = statements.slice(i, i + batchSize);
    await db.batch(chunk as [any, ...any[]]);
  }
};
