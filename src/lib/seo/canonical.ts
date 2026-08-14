import { SITE_URL } from "@/lib/config";
import { locales, routing } from "@/lib/i18n/routing";
import { localePath } from "@/lib/i18n/localePath";

/**
 * canonical URL を組み立てる。自己参照になるようロケールごとに別URLを返す。
 *
 * @param path 先頭スラッシュ付きのロケール接頭辞なしパス（ルートは ""）
 * @param locale 対象ロケール
 */
export function canonicalUrl(path: string = "", locale: string = routing.defaultLocale): string {
  return SITE_URL + localePath(path, locale);
}

/**
 * hreflang 用の言語別URL表。x-default は既定ロケール(日本語版)を指す。
 *
 * @param path 先頭スラッシュ付きのロケール接頭辞なしパス（ルートは ""）
 */
export function languageAlternates(path: string = "", available?: readonly string[]): Record<string, string> {
  // 機械翻訳しかないロケールを載せると自動生成ページを各言語版として索引させることになる。
  // 呼び出し側が「人手で確定した言語」を渡した場合はそれだけに絞る。
  const targets = available ? locales.filter((l) => available.includes(l)) : locales;
  const languages: Record<string, string> = {};
  for (const locale of targets) languages[locale] = canonicalUrl(path, locale);
  languages["x-default"] = canonicalUrl(path, routing.defaultLocale);
  return languages;
}

/**
 * generateMetadata の `alternates` にそのまま渡せる canonical + hreflang の組。
 *
 * @param path 先頭スラッシュ付きのロケール接頭辞なしパス（ルートは ""）
 * @param locale 現在のロケール
 */
export function seoAlternates(path: string = "", locale: string = routing.defaultLocale, available?: readonly string[]) {
  return {
    canonical: canonicalUrl(path, locale),
    languages: languageAlternates(path, available),
  };
}

/** サイト名。og:site_name と JSON-LD の name を必ず一致させる */
export const SITE_NAME = "ModParks";
