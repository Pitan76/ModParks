import { getDdosState } from "./worker/ddos-state.js";
import { trackRequest } from "./worker/ddos-stats.js";
import { handleDdosCron } from "./worker/ddos-cron.js";
import { isBotRequest } from "./worker/bot-detect.js";
import { getRuntimeMode, handleRestrictedMode } from "./worker/runtime-mode.js";
import { isCacheableRequest, matchHtml, storeHtml, warmHtmlCache } from "./worker/html-cache.js";

/**
 * OpenNext の本体は遅延読み込みにする。
 *
 * 静的な import だと Isolate の起動時に Next.js のバンドル全体が評価され、
 * その CPU をキャッシュヒットの要求まで負担することになる。
 */
let openNextWorkerPromise = null;
function loadOpenNextWorker() {
  if (!openNextWorkerPromise) openNextWorkerPromise = import("./.open-next/worker.js").then((m) => m.default);

  return openNextWorkerPromise;
}

// 式は wrangler.toml の [triggers] crons と一致させること
const CRON_ROUTES = {
  "0 * * * *": "/api/cron/sync-external",
  "0 3 * * *": "/api/cron/backup",
  // ddos_slices は 30 分で削除されるため、それより短い間隔で取り込む必要がある
  "*/10 * * * *": "/api/cron/usage",
  "30 3 * * *": "/api/cron/trust",
  "45 3 * * *": "/api/cron/cleanup",
};

/** Cron から Next.js 側のルートを内部的に叩く */
async function invokeCronRoute(path, env, ctx) {
  const req = new Request(`http://localhost${path}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${env.CRON_SECRET || ""}` },
  });

  // Cron の1本が落ちても他の処理を続けたいので、ここで結果に畳み込む
  try {
    const worker = await loadOpenNextWorker();
    const res = await worker.fetch(req, env, ctx);
    if (res.ok) {
      console.log(`Cron ${path} processed successfully:`, await res.json());
      return;
    }
    console.error(`Cron ${path} failed with status:`, res.status, await res.text());
  } catch (e) {
    console.error(`Cron ${path} fetch error:`, e);
  }
}

/** 温めを行う Cron。CRON_ROUTES と同じ枠に相乗りする */
const WARM_CRON = "*/10 * * * *";

/**
 * 公開ページのキャッシュを Cron の枠で埋め直す。
 *
 * 失敗しても閲覧者には影響しないため、ここで畳み込んで他の Cron を止めない。
 */
async function warmPublicPages(env, ctx) {
  try {
    const worker = await loadOpenNextWorker();
    const warmed = await warmHtmlCache(env.NEXT_PUBLIC_APP_URL, (req) => worker.fetch(req, env, ctx));
    console.log(`[HTML-CACHE] Warmed ${warmed} pages`);
  } catch (e) {
    console.error("[HTML-CACHE] Warm failed:", e);
  }
}

function isDownloadPath(path) {
  return path === "/api/download" || path.startsWith("/api/download/");
}

/** lib/download/countPolicy.ts と対応させること */
const DDOS_STATE_HEADER = "x-mp-ddos-state";
const BOT_HEADER = "x-mp-bot";

/**
 * ダウンロード計数の判定材料をヘッダへ載せ替える。
 *
 * Next.js 側で D1 や cf を引き直さずに済ませるためのもの。
 * クライアントが同名ヘッダを送ってきても、ここで必ず上書きするため詐称できない。
 */
function withCountSignals(req, state, isBot) {
  const headers = new Headers(req.headers);
  headers.set(DDOS_STATE_HEADER, state);
  headers.set(BOT_HEADER, isBot ? "1" : "0");

  return new Request(req, { headers });
}

export default {
  /** OpenNext の fetch ハンドラをラップし、手前でDDoS統計の収集だけを行う */
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 運用モードの判定は最初に行う。止めている間は本体の処理を一切走らせない
    const restricted = handleRestrictedMode(
      req,
      url,
      await getRuntimeMode(env),
      env.ARCHIVE_ORIGIN || url.origin
    );
    if (restricted) return restricted;

    const isDownload = isDownloadPath(url.pathname);
    let forwarded = req;

    // 集計はあくまで付随処理なので、失敗しても Next.js への転送は必ず行う
    try {
      const state = await getDdosState(env.DB);
      const isBot = isBotRequest(req);

      // 防護中は WAF 側が捌くため、集計するのは NORMAL のときだけ
      if (state.currentState === "NORMAL") {
        trackRequest(req, url, env, ctx, isDownload, isBot);
      }
      // ヘッダの付け替えはコストがかかるため、判定を使うダウンロードのみに限る
      if (isDownload) {
        forwarded = withCountSignals(req, state.currentState, isBot);
      }
    } catch (e) {
      console.error("[DDOS-GUARD] Intercept error:", e);
    }

    const cacheable = isCacheableRequest(req, url);
    if (cacheable) {
      const hit = await matchHtml(req, url);
      if (hit) return hit;
    }

    const worker = await loadOpenNextWorker();
    const res = await worker.fetch(forwarded, env, ctx);

    return cacheable ? storeHtml(ctx, req, url, res) : res;
  },

  /** Cloudflare Cron Triggers 用のハンドラ */
  async scheduled(controller, env, ctx) {
    await handleDdosCron(env);

    const path = CRON_ROUTES[controller.cron];
    if (path) {
      console.log(`Cron triggered (${controller.cron}): invoking ${path}`);
      await invokeCronRoute(path, env, ctx);
    }

    if (controller.cron === WARM_CRON) await warmPublicPages(env, ctx);
  },
};
