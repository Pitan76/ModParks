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

/**
 * データベースの全テーブルのデータをダンプし、JSON 形式で R2 バケットに保存します。
 */
export async function createBackup() {
  const { db } = await getAdminDb();

  const backupData: Record<string, any[]> = {};

  for (const [tableName, tableObj] of Object.entries(SCHEMA_TABLES)) {
    const data = await db.select().from(tableObj).all();
    backupData[tableName] = data;
  }

  const payload = {
    version: "1.0",
    timestamp: Date.now(),
    tables: backupData,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const key = `backup/backup_${payload.timestamp}.json`;

  const { getR2Bucket, uploadToR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  await uploadToR2(bucket, key, jsonStr, "application/json");

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

  const { getR2Bucket, deleteFromR2 } = await import("@/lib/r2");
  const bucket = await getR2Bucket();

  await deleteFromR2(bucket, key);

  revalidatePath("/admin/backup");
  return { success: true };
}

/**
 * 指定されたテーブルデータを用いてデータベースをリストアします。
 * トランザクション内で全削除および再インサートを行います。
 */
async function importBackupData(db: any, tablesData: Record<string, any[]>) {
  await db.transaction(async (tx: any) => {
    // 1. 削除処理 (子から親の順 = TABLE_RESTORE_ORDER の逆順)
    const deleteOrder = [...TABLE_RESTORE_ORDER].reverse();
    for (const tableName of deleteOrder) {
      const tableObj = SCHEMA_TABLES[tableName];
      if (tableObj) {
        await tx.delete(tableObj);
      }
    }

    // 2. 挿入処理 (親から子の順 = TABLE_RESTORE_ORDER の順)
    for (const tableName of TABLE_RESTORE_ORDER) {
      const tableObj = SCHEMA_TABLES[tableName];
      const rows = tablesData[tableName];
      if (tableObj && rows && rows.length > 0) {
        // SQLite のプレースホルダーパラメータ制限に引っかからないよう、
        // データを 100 件ずつのチャンクに分けてインサートします
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          await tx.insert(tableObj).values(chunk);
        }
      }
    }
  });
}

/**
 * R2 バケット上の指定されたバックアップファイルからデータを復元します。
 */
export async function restoreBackup(key: string) {
  const { db } = await getAdminDb();

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  const obj = await bucket.get(key);
  if (!obj) {
    throw new Error("Backup file not found in R2");
  }

  const jsonStr = await obj.text();
  const payload = JSON.parse(jsonStr);

  if (!payload.tables || !payload.version) {
    throw new Error("Invalid backup file format");
  }

  await importBackupData(db, payload.tables);

  revalidatePath("/admin/backup");
  return { success: true };
}

/**
 * 送信された JSON 文字列データからデータベースを復元します。
 */
export async function restoreBackupFromJson(jsonStr: string) {
  const { db } = await getAdminDb();

  const payload = JSON.parse(jsonStr);

  if (!payload.tables || !payload.version) {
    throw new Error("Invalid backup file format");
  }

  await importBackupData(db, payload.tables);

  revalidatePath("/admin/backup");
  return { success: true };
}
