import { getDdosState } from "./worker/ddos-state.js";
import { trackRequest } from "./worker/ddos-stats.js";
import { handleDdosCron } from "./worker/ddos-cron.js";
import { handleUsageCron } from "./worker/usage-cron.js";
import { isBotRequest } from "./worker/bot-detect.js";
import { getRuntimeMode, handleRestrictedMode } from "./worker/runtime-mode.js";
import { isCacheableRequest, serveCachedHtml, cacheRenderedHtml, warmHtmlStore } from "./worker/html-serve.js";
import { setCacheGeneration } from "./worker/html-key.js";

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

/**
 * 5 分ごとの Cron。
 *
 * 取り込みと温めを交互に受け持ち、それぞれ 10 分間隔で回る。同じ起動で両方やると、描画が取り込みと
 * 10ms を食い合ってどちらも打ち切られるため、起動そのものを分ける必要がある。
 * ただし Free の cron トリガーは 5 本までで、枠を増やす余地は無い。
 * そこで 5 分ごとに発火させ、1 回の起動では片方だけを走らせる。
 */
const TICK_CRON = "*/5 * * * *";

/** 5 分ごとに 1 増える連番。奇数の回を温めに充てる */
function tickIndex(controller) {
  return Math.floor(controller.scheduledTime / 300000);
}

/** 温める対象の順番を決める連番。温めの回ごとに 1 増える */
function warmTarget(tick) {
  return Math.floor(tick / 2);
}

/**
 * 公開ページを描画して KV へ入れ直す。
 *
 * 失敗しても閲覧者には影響しないため、ここで畳み込んで他の Cron を止めない。
 */
async function warmPublicPages(env, ctx, tick) {
  try {
    const worker = await loadOpenNextWorker();
    const warmed = await warmHtmlStore(env.SETTINGS_KV, (req) => worker.fetch(req, env, ctx), tick);
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
    setCacheGeneration(env.CF_VERSION_METADATA?.id);
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
      const cached = await serveCachedHtml(req, url, env, ctx);
      if (cached) return cached;
    }

    const worker = await loadOpenNextWorker();
    const res = await worker.fetch(forwarded, env, ctx);

    return cacheable ? cacheRenderedHtml(ctx, req, url, res) : res;
  },

  /** Cloudflare Cron Triggers 用のハンドラ */
  async scheduled(controller, env, ctx) {
    setCacheGeneration(env.CF_VERSION_METADATA?.id);
    if (controller.cron === TICK_CRON) {
      const tick = tickIndex(controller);
      // 温めは描画に予算を使い切るため、この回では他を一切走らせない
      if (tick % 2 === 1) return warmPublicPages(env, ctx, warmTarget(tick));

      await handleDdosCron(env);

      return handleUsageCron(env);
    }

    const path = CRON_ROUTES[controller.cron];
    if (!path) return;

    console.log(`Cron triggered (${controller.cron}): invoking ${path}`);
    await invokeCronRoute(path, env, ctx);
  },
};
