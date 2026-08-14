import { locales, routing } from "@/lib/i18n/routing";

/** 先頭スラッシュを保証し、ルートは空文字に正規化する */
const normalizePath = (path: string): string => {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
};

/**
 * ロケール接頭辞付きのサイト内パスを組み立てる。
 * localePrefix は "as-needed" のため、既定ロケール(ja)だけ接頭辞が付かない。
 *
 * @param path 先頭スラッシュ付きのロケール接頭辞なしパス（ルートは ""）
 * @param locale 対象ロケール
 */
export function localePath(path: string = "", locale: string = routing.defaultLocale): string {
  const normalized = normalizePath(path);
  if (locale === routing.defaultLocale) return normalized;
  return `/${locale}${normalized}`;
}

/**
 * `/en/admin` のようなロケール接頭辞つきパスから接頭辞を取り除く。
 * next/navigation の usePathname は接頭辞を含んだ実URLを返すため、
 * next-intl の provider の外側でパスを判定したい箇所で使う。
 *
 * @param pathname ブラウザ上の実パス
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}
