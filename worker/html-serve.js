import { LOCALE_COOKIE } from "./locale.js";
import { THEME_COOKIE, THEMES, isCacheableRequest, resolveLocale, variantKey } from "./html-key.js";
import { matchCachedHtml, putCachedHtml } from "./html-cache.js";
import { readStoredHtml, writeStoredHtml } from "./html-store.js";

/**
 * 公開ページを SSR なしで返すための 2 層キャッシュ。
 *
 * 1 リクエストの CPU 上限に対して Next.js の描画は桁が足りないため、
 * 閲覧者のリクエストでは描画させない。描画は Cron の枠でだけ行う。
 */

export { isCacheableRequest };

/** 共有してよい応答の種類。ページに加えてクローラー向けの生成物も含める */
const STORABLE_TYPES = ["text/html", "text/plain", "application/xml", "text/xml"];

function isStorable(res) {
  if (res.status !== 200) return false;
  const type = res.headers.get("content-type") || "";

  return STORABLE_TYPES.some((allowed) => type.includes(allowed));
}

/**
 * 保存済みの応答を、この閲覧者へ返す形に戻す。
 *
 * 共有キャッシュ向けの指示はブラウザへ持ち出さない。Set-Cookie を伴う応答を
 * 中継機に共有させないため。
 */
function toClientResponse(res, locale, source) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  headers.set("x-mp-html-cache", source);

  const isHtml = (headers.get("content-type") || "").includes("text/html");
  if (isHtml) headers.append("Set-Cookie", `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=lax`);

  return new Response(res.body, { status: res.status, headers });
}

/**
 * キャッシュから返せるなら返す。返せなければ null。
 *
 * colo キャッシュ → KV の順に見て、KV で拾えたぶんは colo にも写しておく。
 */
export async function serveCachedHtml(req, url, env, ctx) {
  const key = variantKey(req, url);
  const locale = resolveLocale(req, url);

  const cached = await matchCachedHtml(url.origin, key);
  if (cached) return toClientResponse(cached, locale, "hit");

  const stored = await readStoredHtml(env.SETTINGS_KV, key);
  if (!stored) return null;

  const [toCache, toClient] = stored.body.tee();
  ctx.waitUntil(putCachedHtml(url.origin, key, new Response(toCache, { status: 200, headers: stored.headers })));

  return toClientResponse(new Response(toClient, { status: 200, headers: stored.headers }), locale, "kv");
}

/** 描画した応答を colo キャッシュへ写しつつ、閲覧者へ返す複製を作る */
export function cacheRenderedHtml(ctx, req, url, res) {
  if (!isStorable(res)) return res;

  const [toCache, toClient] = res.body.tee();
  ctx.waitUntil(putCachedHtml(url.origin, variantKey(req, url), new Response(toCache, { status: res.status, headers: res.headers })));

  return new Response(toClient, { status: res.status, headers: res.headers });
}

/** Cron で先に描いておく対象。themed が false のものは言語もテーマも影響しない */
const WARM_TARGETS = [
  { path: "/",             themed: true  },
  { path: "/projects",     themed: true  },
  { path: "/ideas",        themed: true  },
  { path: "/en",           themed: true  },
  { path: "/en/projects",  themed: true  },
  { path: "/en/ideas",     themed: true  },
  { path: "/robots.txt",   themed: false },
  { path: "/sitemap.xml",  themed: false },
];

/**
 * 温める 1 件ぶんの要求を組み立てる。
 *
 * 宛先は公開ホスト名ではなく localhost にする。公開ホスト宛てにすると
 * Worker が自分の外側へ出ていく形になり、跳ね返って 522 になる
 * （worker-wrapper.js の invokeCronRoute と同じ理由）。
 */
function warmRequest(path, theme) {
  const headers = theme ? { cookie: `${THEME_COOKIE}=${theme}` } : {};

  return new Request(`http://localhost${path}`, { headers });
}

/**
 * 1 件を描画して KV へ保存する。
 *
 * 保存できなかった場合は理由を残す。どの組み合わせが落ちたか分からないと、
 * 温めた件数が合わないときに追えないため。
 */
async function warmOne(kv, path, theme, fetchPage) {
  const req = warmRequest(path, theme);
  const res = await fetchPage(req);
  if (!isStorable(res)) {
    console.error(`[HTML-CACHE] skip ${path} theme=${theme || "any"} status=${res.status} type=${res.headers.get("content-type")}`);

    return false;
  }

  await writeStoredHtml(kv, variantKey(req, new URL(req.url)), res);

  return true;
}

/** 温める組み合わせを平坦に展開したもの */
const WARM_UNITS = WARM_TARGETS.flatMap(({ path, themed }) =>
  (themed ? THEMES : [null]).map((theme) => ({ path, theme })));

/**
 * 1 ティックで温める件数。
 *
 * 全件を 1 回で描くと Cron 自体が CPU 上限で打ち切られ、1 件も保存されずに終わる。
 * 少しずつ順繰りに回して、数ティックかけて一周させる。
 */
const WARM_BATCH = 3;

/**
 * 公開ページを描画して KV を埋める。
 *
 * @param tick 10 分ごとに 1 増える連番。どこから温めるかを決めるのに使う
 */
export async function warmHtmlStore(kv, fetchPage, tick) {
  const start = (tick * WARM_BATCH) % WARM_UNITS.length;
  let warmed = 0;

  for (let i = 0; i < WARM_BATCH; i++) {
    const { path, theme } = WARM_UNITS[(start + i) % WARM_UNITS.length];
    if (await warmOne(kv, path, theme, fetchPage)) warmed++;
  }

  return `${warmed}/${WARM_BATCH}`;
}
