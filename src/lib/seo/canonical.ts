import { SITE_URL } from "@/lib/config";

/**
 * canonical URL を組み立てる。
 *
 * routing の localePrefix は "never" のため、URL にロケール接頭辞は付かない。
 * `/ja/...` `/en/...` は middleware が 307 で接頭辞なしへ戻すので、
 * canonical に使うとリダイレクト先を指すことになり Google が自己参照と認めない。
 *
 * @param path 先頭スラッシュ付きのロケール接頭辞なしパス（ルートは ""）
 */
export function canonicalUrl(path: string = ""): string {
  if (!path || path === "/") return SITE_URL;
  return SITE_URL + (path.startsWith("/") ? path : `/${path}`);
}

/** サイト名。og:site_name と JSON-LD の name を必ず一致させる */
export const SITE_NAME = "ModParks";
