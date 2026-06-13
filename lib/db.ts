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

/** D1 バインディングから Drizzle インスタンスを生成 */
export function getDb(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

let localD1Proxy: D1Database | null = null;

/**
 * 実行環境（本番/エッジ）またはローカル環境（Next dev）に応じた D1 バインディングを取得する。
 * ローカル開発時は Wrangler の Platform Proxy を使用します。
 */
export async function getD1(): Promise<D1Database> {
  // 開発環境かつ Node.js ランタイムの場合のみ Wrangler の Proxy を利用
  if (
    process.env.NODE_ENV === "development" &&
    typeof process !== "undefined" &&
    process.release?.name === "node"
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
