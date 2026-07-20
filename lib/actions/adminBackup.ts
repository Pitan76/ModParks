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

/**
 * サーバーアクションのエラーは、本番ビルドでは Next.js がメッセージを秘匿します
 * （"An error occurred in the Server Components render..." に置き換わる）。
 * そのため throw ではエラー内容が UI に届かず、原因調査にログが必須になってしまいます。
 * 利用者に伝えるべきエラーは例外にせず、この形で返してください。
 */
export type ActionError = { success: false; error: string; message: string };

function toActionError(e: any): ActionError {
  const message = e?.message ?? String(e);
  // 呼び出し側が分岐に使うコード。認証系は auth-helpers が投げる固定文字列。
  const known = ["TWO_FACTOR_REQUIRED", "INVALID_CODE", "Forbidden", "Unauthorized"];
  return { success: false, error: known.includes(message) ? message : "ERROR", message };
}

/**
 * データベースの全テーブルのデータをダンプし、JSON 形式で R2 バケットに保存します。
 */
export async function createBackup() {
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
    // Drive への退避が失敗していても R2 側は成功しているので、その旨を呼び出し側に返す
    return { success: true, key, driveError: drive?.error };
  } catch (e: any) {
    await writeAuditLog(db, {
      action: "create",
      status: "failure",
      detail: { error: e?.message ?? String(e) },
      ...actor,
    });
    throw e;
  }
}

/**
 * バックアップ関連の外部設定が揃っているかを返します。
 * 暗号鍵が無いとバックアップ作成自体が失敗するため、UI で事前に警告するのに使います。
 */
export async function getEncryptionStatus() {
  await getAdminDb();
  const { isEncryptionConfigured } = await import("@/lib/backup/crypto");
  const { getDriveConfig } = await import("@/lib/backup/googleDrive");

  return {
    configured: isEncryptionConfigured(),
    driveConfigured: getDriveConfig() !== null,
  };
}

/**
 * 既存のバックアップを手動で Google Drive に送ります。
 *
 * 自動退避 (driveBackupEnabled) とは独立した操作です。
 * 管理者が明示的に実行するものなので設定のオン/オフは条件にせず、
 * シークレットが揃っていることだけを必要とします。
 *
 * 世代整理は行いません。手動送信で他の世代が消えるのは想定外の挙動になるためです。
 */
export async function sendBackupToDrive(
  key: string
): Promise<{ success: true; fileId: string; webViewLink?: string } | ActionError> {
  const { db, userId } = await getAdminDb();
  const actor = await getActor(db, userId);

  const payload = await loadBackupFromR2(key);
  const fileName = key.split("/").pop() ?? key;

  try {
    const { uploadBackupToDrive } = await import("@/lib/backup/googleDrive");
    // R2 に入っている内容をそのまま送る（暗号化済みの形を保つ）
    const uploaded = await uploadBackupToDrive(fileName, JSON.stringify(payload));

    await writeAuditLog(db, {
      action: "drive_upload",
      status: "success",
      backupKey: key,
      detail: { fileId: uploaded.id, fileName, parents: uploaded.parents },
      ...actor,
    });

    return { success: true as const, fileId: uploaded.id, webViewLink: uploaded.webViewLink };
  } catch (e: any) {
    await writeAuditLog(db, {
      action: "drive_upload",
      status: "failure",
      backupKey: key,
      detail: { error: e?.message ?? String(e) },
      ...actor,
    });
    // Google API のエラー本文は原因特定に直結するので、秘匿されないよう戻り値で返す
    return toActionError(e);
  }
}

/**
 * R2 バケットに保存されているバックアップファイルの一覧を取得します。
 */
export async function getBackups() {
  await getAdminDb();

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  const list = await bucket.list({ prefix: "backup/" });

  const backups = list.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploadedAt: obj.uploaded.toISOString(),
  }));

  // アップロード日時の降順（新しい順）でソート
  backups.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return backups;
}

/**
 * 指定されたキーのバックアップファイルを R2 バケットから削除します。
 */
export async function deleteBackup(key: string) {
  const { db, userId } = await getAdminDb();

  // key はクライアントから渡ってくるため、バックアップ以外の
  // R2 オブジェクト（アップロード済みファイル等）を消せないよう制限します
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
}

/**
 * 復元直前の状態を snapshot/ に退避し、そのキーとダウンロード URL を返します。
 *
 * UI 側はこれを呼んで管理者に手元へダウンロードさせてから復元に進みます。
 * R2 上にも残りますが、R2 ごと失う障害に備えて手元コピーを促す意図です。
 */
export async function createPreRestoreSnapshot() {
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
}

/**
 * 検証済みのテーブルデータで DB を置換します。
 * 置換前に必ず現状のスナップショットを取得し、切り戻し元を確保します。
 *
 * `snapshotKey` に createPreRestoreSnapshot() の結果を渡すと、
 * 二重にスナップショットを取らずにそれを切り戻し元として扱います。
 */
async function performRestore(
  db: any,
  payload: any,
  snapshotKey: string | undefined,
  actor: { performedBy?: string; performedByEmail?: string },
  backupKey?: string
) {
  const tables = await loadBackupTables(payload);

  // 復元は既存データを全削除します。取り返しがつかないため、
  // 実行直前の状態を必ず snapshot/ に退避してから進めます。
  const effectiveSnapshotKey = snapshotKey ?? (await dumpToR2(db, "snapshot")).key;

  const rowCounts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length])
  );

  try {
    await importBackupData(db, tables);
  } catch (e: any) {
    await writeAuditLog(db, {
      action: "restore",
      status: "failure",
      backupKey,
      snapshotKey: effectiveSnapshotKey,
      detail: { error: e?.message ?? String(e) },
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
  return { success: true as const, snapshotKey: effectiveSnapshotKey };
}

/**
 * R2 バケット上の指定されたバックアップファイルからデータを復元します。
 */
export async function restoreBackup(key: string, totpToken: string, snapshotKey?: string) {
  try {
    // 復元は取り消しの効かない全置換のため、管理者権限に加えて TOTP 再認証を要求します
    const { db, userId } = await getReauthenticatedAdminDb(totpToken);
    // 操作者情報は復元前に確定させます。復元後は users が入れ替わり、userId から引けなくなるためです。
    const actor = await getActor(db, userId);

    return await performRestore(db, await loadBackupFromR2(key), snapshotKey, actor, key);
  } catch (e: any) {
    return toActionError(e);
  }
}

/**
 * R2 上のバックアップを読み出します。復元・マージの入口で共用します。
 */
async function loadBackupFromR2(key: string) {
  if (!key.startsWith("backup/") && !key.startsWith("snapshot/")) {
    throw new Error("Invalid backup key");
  }

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  const obj = await bucket.get(key);
  if (!obj) {
    throw new Error("Backup file not found in R2");
  }

  return JSON.parse(await obj.text());
}

/**
 * マージ内容を試算します。DBは変更しません。
 *
 * 全置換の復元と違い現行データを消さないため、TOTP 再認証までは求めず
 * 管理者権限のみで試算できるようにしています。
 */
export async function planMergeFromBackup(key: string) {
  const { db } = await getAdminDb();
  const { planMerge } = await import("@/lib/backup/merge");

  return planMerge(db, await loadBackupFromR2(key));
}

/** アップロードされた JSON からマージ内容を試算します。 */
export async function planMergeFromJson(jsonStr: string) {
  const { db } = await getAdminDb();
  const { planMerge } = await import("@/lib/backup/merge");

  return planMerge(db, JSON.parse(jsonStr));
}

/**
 * マージを実行します。
 *
 * 既存データを消しはしませんが、last_write_wins による上書きが発生するため
 * 復元と同様に TOTP 再認証と事前スナップショットを必須にしています。
 */
export async function applyMergeFromBackup(key: string, totpToken: string, snapshotKey?: string) {
  let db: any, actor: { performedBy?: string; performedByEmail?: string };
  let payload: any, effectiveSnapshotKey: string;

  // 再認証やバックアップ読み出しの失敗は、監査ログを書く前なので個別に処理する
  try {
    const ctx = await getReauthenticatedAdminDb(totpToken);
    db = ctx.db;
    actor = await getActor(db, ctx.userId);
    payload = await loadBackupFromR2(key);
    effectiveSnapshotKey = snapshotKey ?? (await dumpToR2(db, "snapshot")).key;
  } catch (e: any) {
    return toActionError(e);
  }

  const { applyMerge } = await import("@/lib/backup/merge");

  try {
    const plan = await applyMerge(db, payload);

    await writeAuditLog(db, {
      action: "merge",
      status: "success",
      backupKey: key,
      snapshotKey: effectiveSnapshotKey,
      detail: { totals: plan.totals },
      ...actor,
    });

    revalidatePath("/admin/backup");
    return { success: true as const, plan, snapshotKey: effectiveSnapshotKey };
  } catch (e: any) {
    await writeAuditLog(db, {
      action: "merge",
      status: "failure",
      backupKey: key,
      snapshotKey: effectiveSnapshotKey,
      detail: { error: e?.message ?? String(e) },
      ...actor,
    });
    return toActionError(e);
  }
}

/**
 * 送信された JSON 文字列データからデータベースを復元します。
 */
export async function restoreBackupFromJson(jsonStr: string, totpToken: string, snapshotKey?: string) {
  try {
    const { db, userId } = await getReauthenticatedAdminDb(totpToken);
    const actor = await getActor(db, userId);

    // ローカルファイルからの復元では R2 上の元キーが存在しないため backupKey は null
    return await performRestore(db, JSON.parse(jsonStr), snapshotKey, actor);
  } catch (e: any) {
    return toActionError(e);
  }
}
