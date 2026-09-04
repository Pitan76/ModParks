import { LOCALE_COOKIE, LOCALES, readCookie, readLocaleCookie } from "./locale.js";

/**
 * 公開ページの HTML を Cache API に載せる。
 *
 * Free プランの CPU 上限(10ms)に対して Next.js の SSR は 1 リクエスト 100ms 超を使う。
 * 描画そのものを速くしても桁が合わないため、ヒット時は SSR を丸ごと飛ばす。
 */

/** キャッシュの保持時間(秒)。新着の反映遅れと CPU 削減の折り合い */
const HTML_TTL_SEC = 60;

/** Auth.js のセッション Cookie 名の共通部分。接頭辞は環境で変わる */
const SESSION_COOKIE_HINT = "session-token";

/**
 * サーバ描画の結果を変える Cookie。
 *
 * theme_mode は layout が、favorites は プロジェクト詳細が読む。
 * theme はキーに含めて共有し、種類が増える favorites は持っている要求だけ素通しにする。
 */
const THEME_COOKIE = "theme_mode";
const FAVORITES_COOKIE = "favorites";

/** ログイン状態でヘッダーの中身が変わるため、匿名の要求だけを共有する */
const CACHEABLE_PATHS = [
  /^\/$/,
  /^\/projects$/,
  /^\/projects\/[^/]+$/,
  /^\/ideas$/,
  /^\/ideas\/[^/]+$/,
  /^\/profile\/[^/]+$/,
  /^\/terms$/,
  /^\/privacy$/,
];

/** 一覧配下でも編集系は個人の状態に依存するため除外する */
const EXCLUDED_SEGMENTS = ["new", "manage", "import", "edit"];

/** ロケール接頭辞を落とした論理パスを返す */
function stripLocale(pathname) {
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
 * キャッシュキー。
 *
 * 接頭辞なしURLでは Cookie が言語を決めるため、キーに言語を含めないと
 * 日本語の応答を英語の閲覧者へ返してしまう。テーマも SSR 結果に出るため同じ扱い。
 */
function cacheKey(req, url, locale) {
  const theme = readCookie(req, THEME_COOKIE) === "light" ? "light" : "dark";

  return new Request(`${url.origin}/__html/${locale}/${theme}${url.pathname}`, { method: "GET" });
}

/**
 * 保存済みの応答を、この閲覧者へ返す形に戻す。
 *
 * 保存用に付けた共有キャッシュ向けの指示は、ブラウザには持ち出さない。
 * Set-Cookie を伴う応答を中継機に共有させないため。
 */
function toClientResponse(res, locale) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  headers.append(
    "Set-Cookie",
    `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=lax`,
  );
  headers.set("x-mp-html-cache", "hit");

  return new Response(res.body, { status: res.status, headers });
}

/** キャッシュ済みなら返す。無ければ null */
export async function matchHtml(req, url) {
  const locale = readLocaleCookie(req, url);
  const hit = await caches.default.match(cacheKey(req, url, locale));

  return hit ? toClientResponse(hit, locale) : null;
}

function isStorable(res) {
  if (res.status !== 200) return false;

  return (res.headers.get("content-type") || "").includes("text/html");
}

/**
 * 応答を保存し、閲覧者へ返す複製を作る。
 *
 * Set-Cookie を持つ応答は Cache API が保存を拒むため、保存用からは取り除く。
 * 落とせるのは言語 Cookie だけであり、それは matchHtml 側で付け直している。
 */
export async function storeHtml(ctx, req, url, res) {
  if (!isStorable(res)) return res;

  const locale = readLocaleCookie(req, url);
  const headers = new Headers(res.headers);
  headers.delete("Set-Cookie");
  headers.set("Cache-Control", `public, max-age=${HTML_TTL_SEC}`);

  const [toStore, toReturn] = res.body.tee();
  ctx.waitUntil(
    caches.default.put(cacheKey(req, url, locale), new Response(toStore, { status: res.status, headers })),
  );

  return new Response(toReturn, { status: res.status, headers: res.headers });
}
