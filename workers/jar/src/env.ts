/**
 * modparks-jar Worker のバインディング定義。
 *
 * この Worker は Service Binding 経由でのみ到達可能にする（workers_dev = false /
 * routes なし）。呼び出し元はメインアプリのみである前提のため、外部URLの
 * 許可ドメイン判定は呼び出し側（lib/validations.ts の isAllowedExternalUrl）が持つ。
 */
export interface JarWorkerEnv {
  /** メインアプリと同一の R2 バケット */
  modparks_storage: R2Bucket;
  /** レシピ CDN の bulk API 用シークレット */
  RECIPE_CDN_SECRET?: string;
}
