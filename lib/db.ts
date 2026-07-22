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
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  modparks_storage: R2Bucket;
  SETTINGS_KV: KVNamespace;
  AUTH_SECRET: string;
  AUTH_GITHUB_ID: string;
  AUTH_GITHUB_SECRET: string;
}

/**
 * 取得したD1バインディングから、Drizzle ORM のインスタンスを生成します。
 * @param d1 Cloudflare D1データベースのバインディング
 * @returns schemaを設定済みの Drizzle D1 Database インスタンス
 */
export function getDb(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

// HMRで localD1Proxy が消失しないよう、globalThisにキャッシュする
const globalForD1 = globalThis as unknown as {
  localD1Proxy?: D1Database;
};

/**
 * Cloudflare D1データベースのバインディングを動的に取得します。
 * 開発環境 (development) の場合は wrangler proxy を経由して D1 を取得し、
 * 本番環境では getCloudflareContext() から取得します。
 */
export async function getD1(): Promise<D1Database> {
  // 開発環境かつ Node.js ランタイムの場合のみ Wrangler の Proxy を利用
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    if (!globalForD1.localD1Proxy) {
      console.time("[D1 Proxy] Initialize platform proxy");
      const { getCachedPlatformProxy } = await import("./proxy");
      const proxy = await getCachedPlatformProxy();
      globalForD1.localD1Proxy = proxy.env.DB;
      console.timeEnd("[D1 Proxy] Initialize platform proxy");
    }
    return globalForD1.localD1Proxy;
  }

  // 本番環境（Cloudflare Workers）では getCloudflareContext() でバインディングを取得
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as Env).DB;
  if (!db) throw new Error("D1 binding not found in CloudflareContext");
  return db;
}

const globalForDb = globalThis as unknown as {
  cachedDb?: any;
};

/**
 * D1バインディングの取得と Drizzle ORM インスタンスの生成をまとめて行うヘルパー。
 * Server Action やルートハンドラで `const db = await getDatabase();` の1行で利用できます。
 * Cloudflare Workersの128MBメモリ制限対策として、Drizzleインスタンスをグローバルにキャッシュします。
 * ローカル開発環境では、Wrangler Proxyの通信オーバーヘッドを避けるため、
 * .wranglerディレクトリ内のSQLiteファイルを直接 node:sqlite でオープンします。
 */
export async function getDatabase(): Promise<DrizzleD1Database<typeof schema>> {
  if (globalForDb.cachedDb) {
    return globalForDb.cachedDb;
  }
  
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      
      const dir = path.join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const sqliteFile = files.find(f => f.endsWith(".sqlite") && f !== "metadata.sqlite");
        if (sqliteFile) {
          const sqlitePath = path.join(dir, sqliteFile);
          console.log(`[D1 Local] Connecting directly to SQLite: ${sqlitePath}`);
          
          const { DatabaseSync } = await import("node:sqlite");
          const { drizzle: drizzleNodeSqlite } = await import("drizzle-orm/node-sqlite");
          
          const sqlite = new DatabaseSync(sqlitePath);
          const db = drizzleNodeSqlite(sqlite, { schema });
          globalForDb.cachedDb = db as any;
          return globalForDb.cachedDb;
        }
      }
    } catch (err) {
      console.warn("[D1 Local] Failed to connect directly to SQLite, falling back to wrangler proxy:", err);
    }
  }

  const d1 = await getD1();
  const db = getDb(d1);
  globalForDb.cachedDb = db;
  return db;
}



