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

/**
 * ログイン中の閲覧者とも共有してよいページ。
 *
 * サーバ描画がセッションを一切見ないものだけを入れること。
 * オーナー判定で内容が変わるページをここへ移すと、非公開の内容が
 * そのまま他の閲覧者へ配信される。追加する前に、そのページとレイアウトが
 * auth() を呼んでいないことを必ず確かめること。
 */
const SHARED_PATHS = [
  /^\/$/,
  /^\/projects$/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

/**
 * 匿名の閲覧者どうしでのみ共有してよいページ。
 *
 * いずれも isOwner / viewerId で表示が変わる。
 * 例えばプロジェクト詳細は非公開・下書きをオーナーにだけ見せているため、
 * ログイン中の描画結果を共有すると他人へ漏れる。
 */
const ANONYMOUS_ONLY_PATHS = [
  /^\/projects\/[^/]+$/,
  /^\/ideas$/,
  /^\/ideas\/[^/]+$/,
  /^\/profile\/[^/]+$/,
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

  const path = stripLocale(url.pathname);
  if (EXCLUDED_SEGMENTS.includes(path.split("/").pop())) return false;
  if (SHARED_PATHS.some((pattern) => pattern.test(path))) return true;

  // ここから先はログイン状態で内容が変わる。お気に入りも詳細ページの描画に出る
  if (hasSessionCookie(req)) return false;
  if (readCookie(req, FAVORITES_COOKIE)) return false;

  return ANONYMOUS_ONLY_PATHS.some((pattern) => pattern.test(path));
}

/**
 * キャッシュの世代。デプロイごとに変わる Worker のバージョン ID を使う。
 *
 * キーにこれが無いと、デプロイ後も前のビルドの HTML が配られ続ける。その HTML は
 * 新しいデプロイで消えた JS（ファイル名にハッシュが付く）を参照するので、
 * ChunkLoadError で画面が壊れる。Server Action の後の再取得では、新旧のビルドの
 * 食い違いから全体の読み直しに入り、また古い HTML が返って無限に読み直していた。
 *
 * 1 つの isolate は 1 つのデプロイ版しか実行しないので、モジュール変数に一度
 * 入れれば足りる。古い世代のキーは二度と読まれず、各キャッシュの期限で消える。
 */
let generation = "0";

/**
 * 世代を設定する。worker-wrapper がリクエストと Cron の入口で呼ぶ。
 * @param versionId env.CF_VERSION_METADATA.id。取れない環境（ローカル）では既定のまま
 */
export function setCacheGeneration(versionId) {
  if (versionId) generation = versionId;
}

/**
 * この要求が読むべきキャッシュの識別子。
 *
 * 接頭辞なしURLでは Cookie が言語を決めるため、キーに言語を含めないと
 * 日本語の応答を英語の閲覧者へ返してしまう。テーマも SSR 結果に出るため同じ扱い。
 * 先頭の世代については setCacheGeneration を参照。
 */
export function variantKey(req, url) {
  if (INVARIANT_PATHS.some((pattern) => pattern.test(url.pathname))) return `${generation}/any/any${url.pathname}`;

  const locale = readLocaleCookie(req, url);
  const theme = readCookie(req, THEME_COOKIE) === "light" ? "light" : "dark";

  return `${generation}/${locale}/${theme}${url.pathname}`;
}

/** 応答へ付け直す言語。variantKey と同じ判定を使う */
export function resolveLocale(req, url) {
  return readLocaleCookie(req, url);
}
