"use server";

import { getAdminDb, getReauthenticatedAdminDb } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  dumpToR2,
  getActor,
  importBackupData,
  loadBackupTables,
  writeAuditLog,
} from "@/lib/backup/core";
import { loadBackupFromR2 } from "./adminBackupQuery";

export { getBackups, getEncryptionStatus, planMergeFromBackup, planMergeFromJson } from "./adminBackupQuery";

export type ActionError = { success: false; error: string; message: string };

const toActionError = (e: any): ActionError => {
  const message = e?.message ?? String(e);
  const known = ["TWO_FACTOR_REQUIRED", "INVALID_CODE", "Forbidden", "Unauthorized"];
  return { success: false, error: known.includes(message) ? message : "ERROR", message };
};

/**
 * データベースの全テーブルのデータをダンプし、JSON 形式で R2 バケットに保存します。
 */
export const createBackup = async () => {
  const { db, userId } = await getAdminDb();
  const actor = await getActor(db, userId);

  try {
    const { key, drive } = await dumpToR2(db, "backup");

    await writeAuditLog(db, {
      action: "create",
      status: "success",
      backupKey: key,
      detail: { drive },
      ...actor,
    });

    revalidatePath("/admin/backup");
    return { success: true, key, driveError: drive?.error };
  } catch (e: unknown) {
    await writeAuditLog(db, {
      action: "create",
      status: "failure",
      detail: { error: e instanceof Error ? e.message : String(e) },
      ...actor,
    });
    throw e;
  }
};

/**
 * 既存のバックアップを手動で Google Drive に送ります。
 */
export const sendBackupToDrive = async (key: string): Promise<{ success: true; fileId: string; webViewLink?: string } | ActionError> => {
  const { db, userId } = await getAdminDb();
  const actor = await getActor(db, userId);

  const payload = await loadBackupFromR2(key);
  const fileName = key.split("/").pop() ?? key;

  try {
    const { uploadBackupToDrive } = await import("@/lib/backup/googleDrive");
    const uploaded = await uploadBackupToDrive(fileName, JSON.stringify(payload));

    await writeAuditLog(db, {
      action: "drive_upload",
      status: "success",
      backupKey: key,
      detail: { fileId: uploaded.id, fileName, parents: uploaded.parents },
      ...actor,
    });

    return { success: true, fileId: uploaded.id, webViewLink: uploaded.webViewLink };
  } catch (e: unknown) {
    await writeAuditLog(db, {
      action: "drive_upload",
      status: "failure",
      backupKey: key,
      detail: { error: e instanceof Error ? e.message : String(e) },
      ...actor,
    });
    return toActionError(e);
  }
};

/**
 * 指定されたキーのバックアップファイルを R2 バケットから削除します。
 */
export const deleteBackup = async (key: string) => {
  const { db, userId } = await getAdminDb();

  if (!key.startsWith("backup/") && !key.startsWith("snapshot/")) {
    throw new Error("Invalid backup key");
  }

  const { getR2Bucket, deleteFromR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  await deleteFromR2(bucket, key);

  await writeAuditLog(db, {
    action: "delete",
    status: "success",
    backupKey: key,
    ...(await getActor(db, userId)),
  });

  revalidatePath("/admin/backup");
  return { success: true };
};

/**
 * 復元直前の状態を snapshot/ に退避し、そのキーとダウンロード URL を返します。
 */
export const createPreRestoreSnapshot = async () => {
  const { db, userId } = await getAdminDb();

  const { key } = await dumpToR2(db, "snapshot");

  await writeAuditLog(db, {
    action: "snapshot",
    status: "success",
    snapshotKey: key,
    ...(await getActor(db, userId)),
  });

  return {
    success: true,
    key,
    downloadUrl: `/api/admin/backup/download?key=${encodeURIComponent(key)}`,
  };
};

/**
 * 検証済みのテーブルデータで DB を置換します。
 */
const performRestore = async (
  db: any,
  payload: any,
  snapshotKey: string | undefined,
  actor: { performedBy?: string; performedByEmail?: string },
  backupKey?: string
) => {
  const tables = await loadBackupTables(payload);
  const effectiveSnapshotKey = snapshotKey ?? (await dumpToR2(db, "snapshot")).key;

  const rowCounts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length])
  );

  try {
    await importBackupData(db, tables);
  } catch (e: unknown) {
    await writeAuditLog(db, {
      action: "restore",
      status: "failure",
      backupKey,
      snapshotKey: effectiveSnapshotKey,
      detail: { error: e instanceof Error ? e.message : String(e) },
      ...actor,
    });
    throw e;
  }

  await writeAuditLog(db, {
    action: "restore",
    status: "success",
    backupKey,
    snapshotKey: effectiveSnapshotKey,
    detail: { rowCounts },
    ...actor,
  });

  revalidatePath("/admin/backup");
  return { success: true, snapshotKey: effectiveSnapshotKey };
};

/**
 * R2 バケット上の指定されたバックアップファイルからデータを復元します。
 */
export const restoreBackup = async (key: string, totpToken: string, snapshotKey?: string) => {
  try {
    const { db, userId } = await getReauthenticatedAdminDb(totpToken);
    const actor = await getActor(db, userId);

    return await performRestore(db, await loadBackupFromR2(key), snapshotKey, actor, key);
  } catch (e: unknown) {
    return toActionError(e);
  }
};

/**
 * マージを実行します。
 */
export const applyMerge = async (key: string, totpToken: string, snapshotKey?: string) => {
  let db: any, actor: { performedBy?: string; performedByEmail?: string };
  let payload: any, effectiveSnapshotKey: string;

  try {
    const ctx = await getReauthenticatedAdminDb(totpToken);
    db = ctx.db;
    actor = await getActor(db, ctx.userId);
    payload = await loadBackupFromR2(key);
    effectiveSnapshotKey = snapshotKey ?? (await dumpToR2(db, "snapshot")).key;
  } catch (e: unknown) {
    return toActionError(e);
  }

  const { applyMerge: runMerge } = await import("@/lib/backup/merge");

  try {
    const plan = await runMerge(db, payload);

    await writeAuditLog(db, {
      action: "merge",
      status: "success",
      backupKey: key,
      snapshotKey: effectiveSnapshotKey,
      detail: { totals: plan.totals },
      ...actor,
    });

    revalidatePath("/admin/backup");
    return { success: true, plan, snapshotKey: effectiveSnapshotKey };
  } catch (e: unknown) {
    await writeAuditLog(db, {
      action: "merge",
      status: "failure",
      backupKey: key,
      snapshotKey: effectiveSnapshotKey,
      detail: { error: e instanceof Error ? e.message : String(e) },
      ...actor,
    });
    return toActionError(e);
  }
};

// 互換性維持: applyMergeFromBackup の re-export もしくはラッパー
export const applyMergeFromBackup = applyMerge;

/**
 * 送信された JSON 文字列データからデータベースを復元します。
 */
export const restoreBackupFromJson = async (jsonStr: string, totpToken: string, snapshotKey?: string) => {
  try {
    const { db, userId } = await getReauthenticatedAdminDb(totpToken);
    const actor = await getActor(db, userId);

    return await performRestore(db, JSON.parse(jsonStr), snapshotKey, actor);
  } catch (e: unknown) {
    return toActionError(e);
  }
};
