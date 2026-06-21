/**
 * アプリケーション全体で利用する設定値
 */
export const API_CONFIG = {
  /** 一覧APIのデフォルト取得件数 */
  DEFAULT_LIMIT: 20,
  /** 一覧APIの最大取得件数 */
  MAX_LIMIT: 80,
} as const;

/** サイトのベースURL */
export const SITE_URL = "https://modparks.pitan76.net";
