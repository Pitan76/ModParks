import { LOCALES, readCookie, readLocaleCookie } from "./locale.js";

/**
 * 共有キャッシュの対象判定とキー導出。
 *
 * Cache API(colo ごと)と KV(全世界)の 2 層で同じキーを使うため、
 * 導出だけをここに切り出している。
 */

/** Auth.js のセッション Cookie 名の共通部分。接頭辞は環境で変わる */
const SESSION_COOKIE_HINT = "session-token";

/**
 * サーバ描画の結果を変える Cookie。
 *
 * theme_mode は layout が、favorites は プロジェクト詳細が読む。
 * theme はキーに含めて共有し、種類が増える favorites は持っている要求だけ素通しにする。
 */
export const THEME_COOKIE = "theme_mode";
const FAVORITES_COOKIE = "favorites";

/** SSR 結果が分かれるテーマ。キャッシュはこの数だけ枝分かれする */
export const THEMES = ["dark", "light"];

/** 匿名の閲覧者に共有してよいページ */
const CACHEABLE_PATHS = [
  /^\/$/,
  /^\/projects$/,
  /^\/projects\/[^/]+$/,
  /^\/ideas$/,
  /^\/ideas\/[^/]+$/,
  /^\/profile\/[^/]+$/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

/** 言語もテーマも影響しないため、1 つだけ持てばよいパス */
const INVARIANT_PATHS = [/^\/robots\.txt$/, /^\/sitemap\.xml$/];

/** 一覧配下でも編集系は個人の状態に依存するため除外する */
const EXCLUDED_SEGMENTS = ["new", "manage", "import", "edit"];

/** ロケール接頭辞を落とした論理パスを返す */
export function stripLocale(pathname) {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }

  return pathname;
}

function hasSessionCookie(req) {
  const cookie = req.headers.get("cookie");

  return Boolean(cookie) && cookie.includes(SESSION_COOKIE_HINT);
}

/**
 * このリクエストを共有キャッシュで扱ってよいか。
 *
 * RSC 要求はルーター状態でペイロードが変わるため対象外にしている。
 */
export function isCacheableRequest(req, url) {
  if (req.method !== "GET") return false;
  if (url.search) return false;
  if (req.headers.get("rsc")) return false;
  if (hasSessionCookie(req)) return false;
  if (readCookie(req, FAVORITES_COOKIE)) return false;

  const path = stripLocale(url.pathname);
  if (EXCLUDED_SEGMENTS.includes(path.split("/").pop())) return false;

  return CACHEABLE_PATHS.some((pattern) => pattern.test(path));
}

/**
 * この要求が読むべきキャッシュの識別子。
 *
 * 接頭辞なしURLでは Cookie が言語を決めるため、キーに言語を含めないと
 * 日本語の応答を英語の閲覧者へ返してしまう。テーマも SSR 結果に出るため同じ扱い。
 */
export function variantKey(req, url) {
  if (INVARIANT_PATHS.some((pattern) => pattern.test(url.pathname))) return `any/any${url.pathname}`;

  const locale = readLocaleCookie(req, url);
  const theme = readCookie(req, THEME_COOKIE) === "light" ? "light" : "dark";

  return `${locale}/${theme}${url.pathname}`;
}

/** 応答へ付け直す言語。variantKey と同じ判定を使う */
export function resolveLocale(req, url) {
  return readLocaleCookie(req, url);
}
