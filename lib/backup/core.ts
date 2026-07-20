/**
 * バックアップ・復元の中核処理。
 *
 * このモジュールは意図的に "use server" を付けていません。
 * lib/actions/adminBackup.ts は "use server" のため全 export が
 * サーバーアクション（外部から到達可能なエンドポイント）になってしまい、
 * db を引数に取る内部関数を置く場所として不適切なためです。
 * cron ハンドラなど、管理者セッションを持たない文脈からはこちらを直接使います。
 */
import * as schema from "@/db/schema";

// DB定義のテーブルオブジェクトと、D1での実際のテーブル名（スネークケースなど）のマッピング
export const SCHEMA_TABLES: Record<string, any> = {
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
export const TABLE_RESTORE_ORDER = [
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
 * 各テーブルの主キーを構成する列（drizzle のプロパティ名）。
 *
 * 墓標 (deleted_records) のキー生成と、マージ復元でのバックアップ行のキー生成の
 * 両方がこの定義を参照します。片方だけ列順がずれると墓標が一致しなくなり、
 * 削除したはずの行が復活するため、定義はここ一箇所に集約しています。
 *
 * バックアップの行は db.select() の結果なので、DB の列名ではなく
 * drizzle のプロパティ名がキーになります。
 */
export const TABLE_PRIMARY_KEYS: Record<string, string[]> = {
  users: ["id"],
  user_profiles: ["userId"],
  user_settings: ["userId"],
  account: ["provider", "providerAccountId"],
  session: ["sessionToken"],
  verificationToken: ["identifier", "token"],
  api_keys: ["id"],
  projects: ["id"],
  categories: ["id"],
  project_categories: ["projectId", "categoryId"],
  versions: ["id"],
  version_loaders: ["versionId", "loader"],
  version_mc_versions: ["versionId", "mcVersion"],
  project_tags: ["projectId", "tag"],
  project_dependencies: ["id"],
  project_members: ["projectId", "userId"],
  project_favorites: ["projectId", "userId"],
  collections: ["id"],
  collection_items: ["collectionId", "projectId"],
  reports: ["id"],
  ideas: ["id"],
  idea_likes: ["ideaId", "userId"],
  idea_comments: ["id"],
  version_ideas: ["versionId", "ideaId"],
  tags: ["id"],
  platforms: ["id"],
  authenticator: ["userId", "credentialID"],
  rate_limits: ["id"],
  user_follows: ["followerId", "followingId"],
  collection_follows: ["userId", "collectionId"],
  project_comments: ["id"],
  password_reset_tokens: ["id"],
  project_subscriptions: ["userId", "projectId"],
  developer_subscriptions: ["subscriberId", "developerId"],
  notifications: ["id"],
};

export type AuditAction = "create" | "auto_create" | "restore" | "merge" | "delete" | "snapshot";

export interface AuditEntry {
  action: AuditAction;
  status: "success" | "failure";
  backupKey?: string;
  snapshotKey?: string;
  detail?: Record<string, unknown>;
  performedBy?: string;
  performedByEmail?: string;
}

/**
 * バックアップ操作を監査ログに記録します。
 *
 * ログ記録の失敗が本体の操作を巻き添えにしないよう、エラーは握り潰して警告に留めます。
 * （復元の直後は users が入れ替わっているため、書き込みが失敗しうる）
 */
export async function writeAuditLog(db: any, entry: AuditEntry) {
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
}

/** 監査ログに残す操作者情報を取得します。 */
export async function getActor(db: any, userId: string) {
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
}

/** バックアップファイルのフォーマット世代。復元側の互換性判定に使います。 */
export const BACKUP_FORMAT_VERSION = "1.0";

/** このフォーマット世代の復元を受け付けるバージョンの一覧。 */
export const SUPPORTED_BACKUP_VERSIONS = ["1.0"];

/**
 * 全テーブルのデータをダンプして R2 に保存し、そのキーを返します。
 * `prefix` で保存先を分けます（通常のバックアップと復元前スナップショットの区別）。
 */
export async function dumpToR2(db: any, prefix: "backup" | "snapshot") {
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
export function validateBackupPayload(payload: unknown): Record<string, any[]> {
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
export async function importBackupData(db: any, tablesData: Record<string, any[]>) {
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
 * 世代数を保つため、backup/ 配下の古いものから削除します。
 * 手動作成分と自動作成分は区別せずまとめて対象にします。
 */
export async function pruneOldBackups(keepCount: number): Promise<string[]> {
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
}

/**
 * cron から呼ばれる自動バックアップ。
 *
 * 管理者セッションが無い文脈で動くため DB を引数で受け取ります。
 * アプリ設定で明示的に有効化されていない場合は何もしません（既定は無効）。
 */
export async function runAutoBackup(db: any) {
  const { getAppSettings } = await import("@/lib/config/readSettings");
  const settings = await getAppSettings();

  if (!settings.autoBackupEnabled) {
    return { success: true, skipped: true, reason: "disabled" as const };
  }

  try {
    const key = await dumpToR2(db, "backup");
    const pruned = await pruneOldBackups(settings.autoBackupKeepCount);

    await writeAuditLog(db, {
      action: "auto_create",
      status: "success",
      backupKey: key,
      detail: { prunedKeys: pruned },
    });

    return { success: true, skipped: false, key, pruned };
  } catch (e: any) {
    await writeAuditLog(db, {
      action: "auto_create",
      status: "failure",
      detail: { error: e?.message ?? String(e) },
    });
    throw e;
  }
}
