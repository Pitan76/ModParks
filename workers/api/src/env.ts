import type { AiBinding } from "@modparks/core/db/client";

/**
 * modparks-api Worker のバインディング定義。
 *
 * メイン Worker と同じ D1 / KV / R2 を名前で参照する。バインディングは
 * ハンドラの env から取り、core へは引数で渡す（core はアンビエントに
 * 環境へ触らない規約のため）。
 */
export interface ApiWorkerEnv {
  DB: D1Database;
  SETTINGS_KV: KVNamespace;
  modparks_storage: R2Bucket;
  AI?: AiBinding;
  NEXT_PUBLIC_APP_URL: string;
  R2_PUBLIC_URL: string;
  /**
   * セッション Cookie の復号鍵。**メイン Worker(modparks) と同じ値**でなければ
   * 復号に失敗し、ログイン中のユーザーが全員未ログイン扱いになる。
   * `wrangler secret put AUTH_SECRET --name modparks-api` で設定する。
   */
  AUTH_SECRET: string;
}
