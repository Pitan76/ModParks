import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Cloudflare Workers バインディングの型 */
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  modparks_storage: R2Bucket;
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

let localD1Proxy: D1Database | null = null;

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
    if (!localD1Proxy) {
      const { getCachedPlatformProxy } = await import("./proxy");
      const proxy = await getCachedPlatformProxy();
      localD1Proxy = proxy.env.DB;
    }
    if (!localD1Proxy) throw new Error("Local D1 proxy not found.");
    return localD1Proxy;
  }

  // 本番環境（Cloudflare Workers）では getCloudflareContext() でバインディングを取得
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as Env).DB;
  if (!db) throw new Error("D1 binding not found in CloudflareContext");
  return db;
}

/**
 * D1バインディングの取得と Drizzle ORM インスタンスの生成をまとめて行うヘルパー。
 * Server Action やルートハンドラで `const db = await getDatabase();` の1行で利用できます。
 */
export async function getDatabase(): Promise<DrizzleD1Database<typeof schema>> {
  const d1 = await getD1();
  return getDb(d1);
}

