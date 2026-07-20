"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import * as schema from "@/db/schema";
import { revalidatePath } from "next/cache";

// DB定義のテーブルオブジェクトと、D1での実際のテーブル名（スネークケースなど）のマッピング
const SCHEMA_TABLES: Record<string, any> = {
  users: schema.users,
  user_profiles: schema.userProfiles,
  user_settings: schema.userSettings,
  account: schema.accounts,
  session: schema.sessions,
  verificationToken: schema.verificationTokens,
  api_keys: schema.apiKeys,
  projects: schema.projects,
  categories: schema.categories,
  project_categories: schema.projectCategories,
  versions: schema.versions,
  version_loaders: schema.versionLoaders,
  version_mc_versions: schema.versionMcVersions,
  project_tags: schema.projectTags,
  project_dependencies: schema.projectDependencies,
  project_members: schema.projectMembers,
  project_favorites: schema.projectFavorites,
  collections: schema.collections,
  collection_items: schema.collectionItems,
  reports: schema.reports,
  ideas: schema.ideas,
  idea_likes: schema.ideaLikes,
  idea_comments: schema.ideaComments,
  version_ideas: schema.versionIdeas,
  tags: schema.tags,
  platforms: schema.platforms,
  authenticator: schema.authenticators,
  rate_limits: schema.rateLimits,
  user_follows: schema.userFollows,
  collection_follows: schema.collectionFollows,
  project_comments: schema.projectComments,
  password_reset_tokens: schema.passwordResetTokens,
  project_subscriptions: schema.projectSubscriptions,
  developer_subscriptions: schema.developerSubscriptions,
  notifications: schema.notifications,
};

// リリストア時のインサート順序（親テーブルを先に、子テーブルを後に挿入する）
// 削除時はこの逆順で処理します。
const TABLE_RESTORE_ORDER = [
  "users",
  "tags",
  "platforms",
  "rate_limits",
  "user_profiles",
  "user_settings",
  "account",
  "session",
  "verificationToken",
  "api_keys",
  "projects",
  "categories",
  "project_categories",
  "versions",
  "version_loaders",
  "version_mc_versions",
  "project_tags",
  "project_dependencies",
  "project_members",
  "project_favorites",
  "collections",
  "collection_items",
  "reports",
  "ideas",
  "idea_likes",
  "idea_comments",
  "version_ideas",
  "authenticator",
  "user_follows",
  "collection_follows",
  "project_comments",
  "password_reset_tokens",
  "project_subscriptions",
  "developer_subscriptions",
  "notifications",
];

/** バックアップファイルのフォーマット世代。復元側の互換性判定に使います。 */
const BACKUP_FORMAT_VERSION = "1.0";

/** このフォーマット世代の復元を受け付けるバージョンの一覧。 */
const SUPPORTED_BACKUP_VERSIONS = ["1.0"];

/**
 * 全テーブルのデータをダンプして R2 に保存し、そのキーを返します。
 * `prefix` で保存先を分けます（通常のバックアップと復元前スナップショットの区別）。
 */
async function dumpToR2(db: any, prefix: "backup" | "snapshot") {
  const backupData: Record<string, any[]> = {};

  for (const [tableName, tableObj] of Object.entries(SCHEMA_TABLES)) {
    const data = await db.select().from(tableObj).all();
    backupData[tableName] = data;
  }

  const payload = {
    version: BACKUP_FORMAT_VERSION,
    timestamp: Date.now(),
    tables: backupData,
  };

  // 整形インデントはファイルサイズを大きく膨らませるだけなので付けません
  const jsonStr = JSON.stringify(payload);
  const key = `${prefix}/${prefix}_${payload.timestamp}.json`;

  const { getR2Bucket, uploadToR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  await uploadToR2(bucket, key, jsonStr, "application/json");

  return key;
}

/**
 * バックアップペイロードの形式を検証します。
 * 未知の世代を現行スキーマに流し込むと不整合を起こすため、バージョンを明示的に照合します。
 */
function validateBackupPayload(payload: unknown): Record<string, any[]> {
  const p = payload as { version?: string; tables?: Record<string, any[]> } | null;

  if (!p || typeof p !== "object" || !p.tables) {
    throw new Error("Invalid backup file format");
  }
  if (!p.version || !SUPPORTED_BACKUP_VERSIONS.includes(p.version)) {
    throw new Error(
      `Unsupported backup version: ${p.version ?? "(none)"}. Supported: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}`
    );
  }

  // 現行スキーマに存在しないテーブルが含まれている場合、その分は復元されません。
  // 黙って落とすと気づけないため、明示的に失敗させます。
  const unknownTables = Object.keys(p.tables).filter((t) => !SCHEMA_TABLES[t]);
  if (unknownTables.length > 0) {
    throw new Error(`Backup contains tables unknown to the current schema: ${unknownTables.join(", ")}`);
  }

  return p.tables;
}

/**
 * データベースの全テーブルのデータをダンプし、JSON 形式で R2 バケットに保存します。
 */
export async function createBackup() {
  const { db } = await getAdminDb();

  const key = await dumpToR2(db, "backup");

  revalidatePath("/admin/backup");
  return { success: true, key };
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
  await getAdminDb();

  // key はクライアントから渡ってくるため、バックアップ以外の
  // R2 オブジェクト（アップロード済みファイル等）を消せないよう制限します
  if (!key.startsWith("backup/") && !key.startsWith("snapshot/")) {
    throw new Error("Invalid backup key");
  }

  const { getR2Bucket, deleteFromR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  await deleteFromR2(bucket, key);

  revalidatePath("/admin/backup");
  return { success: true };
}

// D1 が 1 ステートメントあたりに許容するバインドパラメータの上限。
// 1 行あたりの列数からチャンクサイズを逆算するために使います。
const D1_MAX_BOUND_PARAMS = 100;

/**
 * 行データを、D1 のバインドパラメータ上限を超えないチャンクに分割します。
 * 列数はテーブルごとに異なるため、固定の行数ではなく列数から逆算します。
 */
function chunkRows(rows: any[]): any[][] {
  const columnCount = Math.max(1, Object.keys(rows[0]).length);
  const chunkSize = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnCount));

  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 指定されたテーブルデータを用いてデータベースをリストアします。
 *
 * D1 は prepared statement 経由の明示的な BEGIN / COMMIT を許可しないため、
 * drizzle の `db.transaction()` は使えません。代わりに `db.batch()` を使います。
 * batch は内部で単一のトランザクションとして実行されるため、
 * 「全削除したが再挿入に失敗して DB が空のまま残る」という事態を防げます。
 */
async function importBackupData(db: any, tablesData: Record<string, any[]>) {
  const statements: any[] = [];

  // 1. 削除処理 (子から親の順 = TABLE_RESTORE_ORDER の逆順)
  for (const tableName of [...TABLE_RESTORE_ORDER].reverse()) {
    const tableObj = SCHEMA_TABLES[tableName];
    if (tableObj) {
      statements.push(db.delete(tableObj));
    }
  }

  // 2. 挿入処理 (親から子の順 = TABLE_RESTORE_ORDER の順)
  for (const tableName of TABLE_RESTORE_ORDER) {
    const tableObj = SCHEMA_TABLES[tableName];
    const rows = tablesData[tableName];
    if (tableObj && rows && rows.length > 0) {
      for (const chunk of chunkRows(rows)) {
        statements.push(db.insert(tableObj).values(chunk));
      }
    }
  }

  // batch は空配列を受け付けないため、念のためガードします
  if (statements.length === 0) return;

  await db.batch(statements as [any, ...any[]]);
}

/**
 * 復元直前の状態を snapshot/ に退避し、そのキーとダウンロード URL を返します。
 *
 * UI 側はこれを呼んで管理者に手元へダウンロードさせてから復元に進みます。
 * R2 上にも残りますが、R2 ごと失う障害に備えて手元コピーを促す意図です。
 */
export async function createPreRestoreSnapshot() {
  const { db } = await getAdminDb();

  const key = await dumpToR2(db, "snapshot");

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
async function performRestore(db: any, payload: any, snapshotKey?: string) {
  const tables = validateBackupPayload(payload);

  // 復元は既存データを全削除します。取り返しがつかないため、
  // 実行直前の状態を必ず snapshot/ に退避してから進めます。
  const effectiveSnapshotKey = snapshotKey ?? (await dumpToR2(db, "snapshot"));

  await importBackupData(db, tables);

  revalidatePath("/admin/backup");
  return { success: true, snapshotKey: effectiveSnapshotKey };
}

/**
 * R2 バケット上の指定されたバックアップファイルからデータを復元します。
 */
export async function restoreBackup(key: string, snapshotKey?: string) {
  const { db } = await getAdminDb();

  if (!key.startsWith("backup/") && !key.startsWith("snapshot/")) {
    throw new Error("Invalid backup key");
  }

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  const obj = await bucket.get(key);
  if (!obj) {
    throw new Error("Backup file not found in R2");
  }

  return performRestore(db, JSON.parse(await obj.text()), snapshotKey);
}

/**
 * 送信された JSON 文字列データからデータベースを復元します。
 */
export async function restoreBackupFromJson(jsonStr: string, snapshotKey?: string) {
  const { db } = await getAdminDb();

  return performRestore(db, JSON.parse(jsonStr), snapshotKey);
}
