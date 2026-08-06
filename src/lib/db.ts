import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import dns from "node:dns";

// Windows環境などの localhost 名前解決遅延 (IPv6 優先によるタイムアウト) 対策
if (process.env.NODE_ENV === "development") {
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch (e) {
    console.warn("Failed to set DNS result order to ipv4first:", e);
  }
}

/** Cloudflare Workers バインディングの型 */
export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  modparks_storage: R2Bucket;
  SETTINGS_KV: KVNamespace;
  AUTH_SECRET: string;
  AUTH_GITHUB_ID: string;
  AUTH_GITHUB_SECRET: string;
};

/**
 * 取得したD1バインディングから、Drizzle ORM のインスタンスを生成します。
 * @param d1 Cloudflare D1データベースのバインディング
 * @returns schemaを設定済みの Drizzle D1 Database インスタンス
 */
export const getDb = (d1: D1Database): DrizzleD1Database<typeof schema> => drizzle(d1, { schema });

// HMRで localD1Proxy が消失しないよう、globalThisにキャッシュする
const globalForD1 = globalThis as unknown as {
  localD1Proxy?: D1Database;
};

/**
 * Cloudflare D1データベースのバインディングを動的に取得します。
 * 開発環境 (development) の場合は wrangler proxy を経由して D1 を取得し、
 * 本番環境では getCloudflareContext() から取得します。
 */
export const getD1 = async (): Promise<D1Database> => {
  // 開発環境かつ Node.js ランタイムの場合のみ Wrangler の Proxy を利用
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    if (!globalForD1.localD1Proxy) {
      const { getCachedPlatformProxy } = await import("./proxy");
      const proxy = await getCachedPlatformProxy();
      globalForD1.localD1Proxy = proxy.env.DB;
    }
    return globalForD1.localD1Proxy;
  }

  // 本番環境（Cloudflare Workers）では getCloudflareContext() でバインディングを取得
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as Env).DB;
  if (!db) throw new Error("D1 binding not found in CloudflareContext");
  return db;
};

// 同時リクエストで初期化が多重実行されないよう、値ではなくPromiseをキャッシュする
const globalForDb = globalThis as unknown as {
  cachedDbPromise?: Promise<DrizzleD1Database<typeof schema>>;
};

/**
 * D1バインディングの取得と Drizzle ORM インスタンスの生成をまとめて行うヘルパー。
 * Server Action やルートハンドラで `const db = await getDatabase();` の1行で利用できます。
 * Cloudflare Workersの128MBメモリ制限対策として、Drizzleインスタンスをグローバルにキャッシュします。
 * ローカル開発環境では、Wrangler Proxyの通信オーバーヘッドを避けるため、
 * .wranglerディレクトリ内のSQLiteファイルを直接 node:sqlite でオープンします。
 */
export const getDatabase = async (): Promise<DrizzleD1Database<typeof schema>> => {
  if (!globalForDb.cachedDbPromise) {
    // 失敗したPromiseを残すと以降のリクエストが永続的に失敗するため破棄する
    globalForDb.cachedDbPromise = initDatabase().catch((err) => {
      globalForDb.cachedDbPromise = undefined;
      throw err;
    });
  }
  return globalForDb.cachedDbPromise;
};

/** getDatabase の実体。キャッシュ判定を持たない初期化処理。 */
const initDatabase = async (): Promise<DrizzleD1Database<typeof schema>> => {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    try {
      const { createLocalSqliteDb } = await import("./db-local");
      const localDb = await createLocalSqliteDb();
      if (localDb) return localDb as unknown as DrizzleD1Database<typeof schema>;
    } catch (err) {
      console.warn("[D1 Local] Failed to connect directly to SQLite, falling back to wrangler proxy:", err);
    }
  }

  return getDb(await getD1());
};



