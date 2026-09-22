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
  /** modparks-jar への Service Binding。アップロード後のファイル検査に使う */
  JAR: Fetcher;
  /**
   * 管理者通知（悪性ファイル検出など）の宛先。メイン Worker と同じ値。
   * `wrangler secret put DISCORD_WEBHOOK_URL --name modparks-api` で設定する。
   */
  DISCORD_WEBHOOK_URL?: string;
  /**
   * GitHub の公開リポジトリ読み取り用トークン。レート制限を緩めるため。メイン Worker と同じ値。
   * `wrangler secret put GITHUB_TOKEN --name modparks-api`
   */
  GITHUB_TOKEN?: string;
  /** 非公開リポジトリ用 GitHub App の ID。`wrangler secret put GITHUB_APP_ID --name modparks-api` */
  GITHUB_APP_ID?: string;
  /** 同 App の秘密鍵（PKCS#8）。`wrangler secret put GITHUB_APP_PRIVATE_KEY --name modparks-api` */
  GITHUB_APP_PRIVATE_KEY?: string;
  /**
   * CurseForge のダウンロード数取得用。無ければ CFWidget で代用する。メイン Worker と同じ値。
   * `wrangler secret put CURSEFORGE_FOR_STUDIOS_API_KEY --name modparks-api`
   */
  CURSEFORGE_FOR_STUDIOS_API_KEY?: string;
  /** レシピ CDN の公開 URL（メインと同じ値） */
  NEXT_PUBLIC_RECIPE_CDN_URL: string;
  /** "true" なら jar Worker から CDN の API へ直接上げる（メインと同じ値） */
  USE_RECIPE_CDN_API?: string;
  /**
   * ブラウザで抽出したレシピを CDN へ中継するときの認証。メイン Worker と同じ値。
   * `wrangler secret put RECIPE_CDN_SECRET --name modparks-api`
   */
  RECIPE_CDN_SECRET?: string;
  /** modparks-push への Service Binding。公開時の通知を Web Push で送る */
  PUSH?: Fetcher;
  VAPID_PUBLIC_KEY?: string;
  /** `wrangler secret put VAPID_PRIVATE_KEY --name modparks-api` */
  VAPID_PRIVATE_KEY?: string;
  /** `wrangler secret put VAPID_SUBJECT --name modparks-api` */
  VAPID_SUBJECT?: string;
}
