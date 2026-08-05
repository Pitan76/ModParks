import openNextWorker from "./.open-next/worker.js";
import { getDdosState } from "./worker/ddos-state.js";
import { trackRequest } from "./worker/ddos-stats.js";
import { handleDdosCron } from "./worker/ddos-cron.js";
import { isBotRequest } from "./worker/bot-detect.js";

// 式は wrangler.toml の [triggers] crons と一致させること
const CRON_ROUTES = {
  "0 * * * *": "/api/cron/sync-external",
  "0 3 * * *": "/api/cron/backup",
};

/** Cron から Next.js 側のルートを内部的に叩く */
async function invokeCronRoute(path, env, ctx) {
  const req = new Request(`http://localhost${path}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${env.CRON_SECRET || ""}` },
  });

  // Cron の1本が落ちても他の処理を続けたいので、ここで結果に畳み込む
  try {
    const res = await openNextWorker.fetch(req, env, ctx);
    if (res.ok) {
      console.log(`Cron ${path} processed successfully:`, await res.json());
      return;
    }
    console.error(`Cron ${path} failed with status:`, res.status, await res.text());
  } catch (e) {
    console.error(`Cron ${path} fetch error:`, e);
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

    return openNextWorker.fetch(forwarded, env, ctx);
  },

  /** Cloudflare Cron Triggers 用のハンドラ */
  async scheduled(controller, env, ctx) {
    await handleDdosCron(env);

    const path = CRON_ROUTES[controller.cron];
    if (!path) return;

    console.log(`Cron triggered (${controller.cron}): invoking ${path}`);
    await invokeCronRoute(path, env, ctx);
  },
};
