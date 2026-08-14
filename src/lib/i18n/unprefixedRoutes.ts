/**
 * ロケール接頭辞を付けないルート。
 *
 * 検索結果に出さない（noindex + robots.txt で拒否）画面はURLで言語を分ける意味がないため、
 * `/settings` のような接頭辞なしURLに統一し、表示言語はCookie（＝ユーザーの設定言語）で決める。
 * 公開ページだけが `/en/...` を持つことで、hreflang の対象と実在するURLが一致する。
 */
export const UNPREFIXED_ROUTES = [
  "/admin",
  "/settings",
  "/dashboard",
  "/notifications",
  "/projects/new",
  "/projects/import",
  "/projects/manage",
  "/ideas/new",
  "/oauth",
] as const;

/** @param pathname ロケール接頭辞を取り除いたパス */
export function isUnprefixedRoute(pathname: string): boolean {
  return UNPREFIXED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
