/**
 * colo ローカルの応答キャッシュ。
 *
 * KV より速く CPU も使わないため前段に置く。colo ごとに独立しているので、
 * ここが空でも KV 側で受けられるようにしてある（html-serve.js）。
 */

/** colo キャッシュの保持時間(秒)。KV の保持期間より短くしておく */
const HTML_TTL_SEC = 1800;

/** Cache API はキーに Request を取るため、変種キーを URL に組み直す */
function cacheKey(origin, key) {
  return new Request(`${origin}/__html/${key}`, { method: "GET" });
}

/** キャッシュ済みの応答。無ければ undefined */
export function matchCachedHtml(origin, key) {
  return caches.default.match(cacheKey(origin, key));
}

/**
 * colo キャッシュへ保存する。
 *
 * Set-Cookie を持つ応答は Cache API が保存を拒む。落とせるのは言語 Cookie だけで、
 * それは閲覧者へ返す直前に付け直している。
 */
export function putCachedHtml(origin, key, res) {
  const headers = new Headers(res.headers);
  headers.delete("Set-Cookie");
  headers.set("Cache-Control", `public, max-age=${HTML_TTL_SEC}`);

  return caches.default.put(cacheKey(origin, key), new Response(res.body, { status: res.status, headers }));
}
