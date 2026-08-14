/**
 * 表示言語を保持するCookie名。
 *
 * localeDetection を切っているため next-intl はこのCookieを読み書きしない。
 * 接頭辞なしルート（管理画面・設定など）の言語決定に使うので、
 * middleware と言語切替UIの双方でこの名前を共有する。
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** 1年間保持する。言語設定は滅多に変わらないため */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * ブラウザ側で表示言語のCookieを更新する。
 * 言語切替の直後に呼び、遷移先の接頭辞なしルートで新しい言語が使われるようにする。
 *
 * @param locale 保存するロケール
 */
export function storeLocaleCookie(locale: string): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
