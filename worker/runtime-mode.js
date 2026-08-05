/**
 * 運用モードの読み取りと振り分け。
 *
 * ページと API を 1 か所で捌くため、Next.js の middleware ではなく
 * ここに置く（middleware は /api を対象外にしている）。
 *
 * lib/runtime/features.ts と同じ形を読む。片方を変えたらもう片方も直すこと。
 */

const RUNTIME_KEY = "app:runtime";

/** 全リクエストで KV を読まないための Isolate 内キャッシュ(ms) */
const CACHE_TTL_MS = 5000;

/** 静的アーカイブの入り口。Static Assets から配信されるため枠を消費しない */
const ARCHIVE_PATH = "/archive";

let cached = null;
let cachedAt = 0;

/**
 * モードに関係なく通す経路。
 *
 * 管理画面を止めると切り替え自体ができなくなるため必ず残す。
 * Cron を止めると自動復帰も止まる。
 */
function isAlwaysAllowed(path) {
  return path.startsWith("/admin")
    || path.startsWith("/api/admin")
    || path.startsWith("/api/cron")
    || path.startsWith("/api/auth")
    || path.startsWith("/_next")
    || path.startsWith(ARCHIVE_PATH);
}

/** 期限切れなら通常運用として扱う。Cron の書き換えを待たない */
function resolveMode(config, now) {
  const state = config && config.mode;
  if (!state || state.mode === "NORMAL") return "NORMAL";
  if (state.mode === "MAINTENANCE") return "MAINTENANCE";

  return state.until && state.until <= now ? "NORMAL" : state.mode;
}

/**
 * 現在の実効モードを返す。
 * 読めなかった場合は通常運用とする。設定が読めないことを理由に止める方が害が大きい。
 */
export async function getRuntimeMode(env) {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return resolveMode(cached, now);

  try {
    cached = (await env.SETTINGS_KV.get(RUNTIME_KEY, "json")) || {};
  } catch (e) {
    console.error("[RUNTIME] Failed to read runtime config:", e);
    cached = {};
  }

  cachedAt = now;
  return resolveMode(cached, now);
}

function serviceUnavailable(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      // 無いとクライアントが即リトライして状況が悪化する
      "Retry-After": "600",
    },
  });
}

/** 読み取り API を静的 JSON へ逃がす。本体の処理（D1 とレンダリング）が消える */
function toArchiveJson(url, archiveOrigin) {
  const detail = url.pathname.match(/^\/api\/(?:v\d\/)?projects\/([^/]+)$/);
  if (detail) return `${archiveOrigin}/v1/projects/${detail[1]}.json`;

  if (/^\/api\/(?:v\d\/)?projects\/?$/.test(url.pathname)) return `${archiveOrigin}/v1/projects.json`;

  return null;
}

/**
 * モードに応じた応答を返す。通してよければ null。
 *
 * @param archiveOrigin 静的データの配信元
 */
export function handleRestrictedMode(req, url, mode, archiveOrigin) {
  if (mode === "NORMAL" || isAlwaysAllowed(url.pathname)) return null;

  if (mode === "MAINTENANCE") return serviceUnavailable("Under maintenance");

  // ここから STATIC
  if (req.method !== "GET" && req.method !== "HEAD") {
    return serviceUnavailable("Read-only mode");
  }

  if (url.pathname.startsWith("/api/")) {
    const target = toArchiveJson(url, archiveOrigin);
    return target
      ? Response.redirect(target, 302)
      : serviceUnavailable("Read-only mode");
  }

  // ページはアーカイブへ。パスをハッシュに載せ替えて同じ画面へ辿り着かせる
  const suffix = url.pathname === "/" ? "" : `#${url.pathname}`;
  return Response.redirect(`${url.origin}${ARCHIVE_PATH}/${suffix}`, 302);
}
