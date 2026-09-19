import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@modparks/core/db/schema";

/**
 * schema を紐付けた Drizzle インスタンスの型。
 * ヘルパーへ db を引き回す際は any ではなくこれを使う。
 */
export type Database = DrizzleD1Database<typeof schema>;

/** Workers AI。説明文の翻訳に使う。@cloudflare/workers-types には Ai の型が無い */
export interface AiBinding {
  run(model: string, input: unknown): Promise<{ response?: string }>;
}

/** Cloudflare Workers バインディングの型 */
export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  modparks_storage: R2Bucket;
  SETTINGS_KV: KVNamespace;
  AI: AiBinding;
  AUTH_SECRET: string;
  AUTH_GITHUB_ID: string;
  AUTH_GITHUB_SECRET: string;
};

/**
 * D1 バインディングから Drizzle ORM のインスタンスを生成する。
 *
 * core が持つのはこの純粋な変換だけ。バインディングをどこから得るかは
 * 呼び出し側の責務で、Next 側は getCloudflareContext()、Workers 側は
 * ハンドラの env から渡す。
 * @param d1 Cloudflare D1 データベースのバインディング
 */
export const getDb = (d1: D1Database): Database => drizzle(d1, { schema });
