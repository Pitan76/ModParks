import * as schema from "@/db/schema";

export { SCHEMA_TABLES, TABLE_RESTORE_ORDER, TABLE_PRIMARY_KEYS } from "./schemaConfig";
export { BACKUP_FORMAT_VERSION, dumpToR2, pruneOldBackups, runAutoBackup } from "./backupExport";
export { SUPPORTED_BACKUP_VERSIONS, validateBackupPayload, loadBackupTables, reviveRows, importBackupData } from "./backupImport";

export type AuditAction =
  | "create"
  | "auto_create"
  | "restore"
  | "merge"
  | "delete"
  | "snapshot"
  | "drive_upload";

export type AuditEntry = {
  action: AuditAction;
  status: "success" | "failure";
  backupKey?: string;
  snapshotKey?: string;
  detail?: Record<string, unknown>;
  performedBy?: string;
  performedByEmail?: string;
};

/**
 * バックアップ操作を監査ログに記録します。
 */
export const writeAuditLog = async (db: any, entry: AuditEntry) => {
  try {
    await db.insert(schema.backupAudit).values({
      action: entry.action,
      status: entry.status,
      backupKey: entry.backupKey ?? null,
      snapshotKey: entry.snapshotKey ?? null,
      detail: entry.detail ?? null,
      performedBy: entry.performedBy ?? null,
      performedByEmail: entry.performedByEmail ?? null,
    });
  } catch (e) {
    console.error("[backup] Failed to write audit log:", e);
  }
};

/**
 * 監査ログに残す操作者情報を取得します。
 */
export const getActor = async (db: any, userId: string) => {
  try {
    const { eq } = await import("drizzle-orm");
    const user = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();
    return { performedBy: userId, performedByEmail: user?.email ?? undefined };
  } catch {
    return { performedBy: userId, performedByEmail: undefined };
  }
};
