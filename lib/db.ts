import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/** Cloudflare Workers バインディングの型 */
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
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
 * 実行環境（本番/エッジ）またはローカル環境（Next dev）に応じた D1 バインディングを取得する。
 * ローカル開発時は Wrangler の Platform Proxy を使用します。
 */
/**
 * Cloudflare D1データベースのバインディングを動的に取得します。
 * 開発環境 (development) の場合は wrangler proxy を経由して D1 を取得し、
 * 本番環境では環境変数 (`process.env.DB`) から取得します。
 * @returns {Promise<D1Database>} 取得したD1データベースのインスタンス
 */
export async function getD1(): Promise<D1Database> {
  // 開発環境かつ Node.js ランタイムの場合のみ Wrangler の Proxy を利用
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    if (!localD1Proxy) {
      // Webpack (Edgeランタイム) がエラーを出さないように ignore する
      const wrangler = await import(/* webpackIgnore: true */ "wrangler");
      const proxy = await wrangler.getPlatformProxy<Env>();
      localD1Proxy = proxy.env.DB;
    }
    if (!localD1Proxy) throw new Error("Local D1 proxy not found.");
    return localD1Proxy;
  }

  // 本番環境（Cloudflare Workers/Pages）では process.env 等にバインディングが渡される
  const db = (process.env as unknown as Env).DB;
  if (!db) throw new Error("D1 binding not found in process.env");
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
