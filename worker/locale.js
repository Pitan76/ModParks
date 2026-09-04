/**
 * Worker 側で使うロケール定義。
 *
 * lib/i18n/locales.ts と lib/i18n/localeCookie.ts と同じ値を持つ。
 * Worker のエントリは Next.js のバンドルより手前で動くため、
 * TypeScript 側を直接読み込まずにここへ写している。片方を変えたらもう片方も直すこと。
 */

export const LOCALES = ["ja", "en"];
export const DEFAULT_LOCALE = "ja";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Cookie ヘッダから該当の値だけを抜く。Cookie の解析器を持ち込まないため */
export function readCookie(req, name) {
  const header = req.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }

  return null;
}

/**
 * この要求の表示言語を決める。
 *
 * URL の接頭辞が最優先で、無い場合のみ Cookie を見る。middleware と同じ順序。
 */
export function readLocaleCookie(req, url) {
  for (const locale of LOCALES) {
    if (url.pathname === `/${locale}` || url.pathname.startsWith(`/${locale}/`)) return locale;
  }

  const cookie = readCookie(req, LOCALE_COOKIE);

  return LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE;
}
