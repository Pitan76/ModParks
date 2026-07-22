import { SCHEMA_TABLES } from "./schemaConfig";
import { writeAuditLog } from "./core";

export const BACKUP_FORMAT_VERSION = "1.0";

export type DriveMirrorResult = {
  attempted: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
};

/**
 * バックアップを Google Drive にも退避します。
 */
const mirrorToDrive = async (key: string, jsonStr: string): Promise<DriveMirrorResult> => {
  const { getAppSettings } = await import("@/lib/config/readSettings");
  const settings = await getAppSettings();

  if (!settings.driveBackupEnabled) return { attempted: false };

  try {
    const { uploadBackupToDrive, pruneDriveBackups, getDriveConfig } = await import(
      "@/lib/backup/googleDrive"
    );

    if (!getDriveConfig()) {
      return {
        attempted: true,
        error:
          "Google Drive backup is enabled but GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID are not all set",
      };
    }

    const fileName = key.split("/").pop() ?? key;
    const uploaded = await uploadBackupToDrive(fileName, jsonStr);

    await pruneDriveBackups(settings.autoBackupKeepCount);

    return { attempted: true, fileId: uploaded.id, webViewLink: uploaded.webViewLink };
  } catch (e: unknown) {
    console.error("[backup] Google Drive mirror failed:", e);
    return { attempted: true, error: e instanceof Error ? e.message : String(e) };
  }
};

/**
 * 全テーブルのデータをダンプして R2 に保存し、そのキーを返します。
 */
export const dumpToR2 = async (db: any, prefix: "backup" | "snapshot") => {
  const { SENSITIVE_TABLES, encryptJson } = await import("@/lib/backup/crypto");

  const backupData: Record<string, any> = {};

  for (const [tableName, tableObj] of Object.entries(SCHEMA_TABLES)) {
    const data = await db.select().from(tableObj).all();
    backupData[tableName] = SENSITIVE_TABLES.has(tableName) ? await encryptJson(data) : data;
  }

  const payload = {
    version: BACKUP_FORMAT_VERSION,
    timestamp: Date.now(),
    tables: backupData,
  };

  const jsonStr = JSON.stringify(payload);
  const key = `${prefix}/${prefix}_${payload.timestamp}.json`;

  const { getR2Bucket, uploadToR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  await uploadToR2(bucket, key, jsonStr, "application/json");

  const drive = prefix === "backup" ? await mirrorToDrive(key, jsonStr) : undefined;

  return { key, drive };
};

/**
 * 世代数を保つため、backup/ 配下の古いものから削除します。
 */
export const pruneOldBackups = async (keepCount: number): Promise<string[]> => {
  const { getR2Bucket, deleteFromR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  const list = await bucket.list({ prefix: "backup/" });
  const sorted = [...list.objects].sort(
    (a, b) => b.uploaded.getTime() - a.uploaded.getTime()
  );

  const stale = sorted.slice(keepCount);
  for (const obj of stale) {
    await deleteFromR2(bucket, obj.key);
  }

  return stale.map((o) => o.key);
};

/**
 * cron から呼ばれる自動バックアップ。
 */
export const runAutoBackup = async (db: any) => {
  const { getAppSettings } = await import("@/lib/config/readSettings");
  const settings = await getAppSettings();

  if (!settings.autoBackupEnabled) {
    return { success: true, skipped: true, reason: "disabled" as const };
  }

  try {
    const { key, drive } = await dumpToR2(db, "backup");
    const pruned = await pruneOldBackups(settings.autoBackupKeepCount);

    await writeAuditLog(db, {
      action: "auto_create",
      status: "success",
      backupKey: key,
      detail: { prunedKeys: pruned, drive },
    });

    return { success: true, skipped: false, key, pruned, drive };
  } catch (e: unknown) {
    await writeAuditLog(db, {
      action: "auto_create",
      status: "failure",
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
};
