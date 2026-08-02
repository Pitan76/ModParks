import openNextWorker from "./.open-next/worker.js";
import { getDdosState } from "./worker/ddos-state.js";
import { trackRequest } from "./worker/ddos-stats.js";
import { handleDdosCron } from "./worker/ddos-cron.js";

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

export default {
  /** OpenNext の fetch ハンドラをラップし、手前でDDoS統計の収集だけを行う */
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 集計はあくまで付随処理なので、失敗しても Next.js への転送は必ず行う
    try {
      const state = await getDdosState(env.DB);
      // 防護中は WAF 側が捌くため、集計するのは NORMAL のときだけ
      if (state.currentState === "NORMAL") {
        trackRequest(req, url, env, ctx, isDownloadPath(url.pathname));
      }
    } catch (e) {
      console.error("[DDOS-GUARD] Intercept error:", e);
    }

    return openNextWorker.fetch(req, env, ctx);
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
