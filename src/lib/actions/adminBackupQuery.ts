"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { loadBackupFromR2 } from "@/lib/backup/loadFromR2";

/**
 * R2 バケットに保存されているバックアップファイルの一覧を取得します。
 */
export const getBackups = async () => {
  await getAdminDb();

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  const list = await bucket.list({ prefix: "backup/" });

  const backups = list.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploadedAt: obj.uploaded.toISOString(),
  }));

  backups.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return backups;
};

/**
 * バックアップ関連の外部設定（暗号鍵・Google Drive）が揃っているかを返します。
 */
export const getEncryptionStatus = async () => {
  await getAdminDb();
  const { isEncryptionConfigured } = await import("@modparks/core/backup/crypto");
  const { getDriveConfig } = await import("@modparks/core/backup/googleDrive");

  return {
    configured: isEncryptionConfigured(),
    driveConfigured: getDriveConfig() !== null,
  };
};

/**
 * バックアップデータからマージ内容（試算）を取得します。
 */
export const planMergeFromBackup = async (key: string) => {
  const { db } = await getAdminDb();
  const { planMerge } = await import("@/lib/backup/merge");

  return planMerge(db, await loadBackupFromR2(key));
};

/**
 * アップロードされた JSON 文字列データからマージ内容（試算）を取得します。
 */
export const planMergeFromJson = async (jsonStr: string) => {
  const { db } = await getAdminDb();
  const { planMerge } = await import("@/lib/backup/merge");

  return planMerge(db, JSON.parse(jsonStr));
};
