import openNextWorker from "./.open-next/worker.js";

/**
 * Cron スケジュールと、それが呼び出す Next.js の API Route の対応表。
 * キーは wrangler.toml の [triggers] crons に書いた式と完全に一致させること。
 */
const CRON_ROUTES = {
  // 毎時0分: 外部サービス (Modrinth / CurseForge) との同期
  "0 * * * *": "/api/cron/sync-external",
  // 毎日 03:00 UTC: 自動バックアップ
  // 実行するかはアプリ設定 (autoBackupEnabled) 側で判定する。既定は無効。
  "0 3 * * *": "/api/cron/backup",
};

/**
 * Next.js の内部 API Route へ疑似リクエストを発行する。
 * ホスト名は localhost で問題なく、openNextWorker.fetch がルーティングを処理します。
 */
async function invokeCronRoute(path, env, ctx) {
  const req = new Request(`http://localhost${path}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${env.CRON_SECRET || ""}`
    }
  });

  try {
    const res = await openNextWorker.fetch(req, env, ctx);
    if (res.ok) {
      console.log(`Cron ${path} processed successfully:`, await res.json());
    } else {
      console.error(`Cron ${path} failed with status:`, res.status, await res.text());
    }
  } catch (e) {
    console.error(`Cron ${path} fetch error:`, e);
  }
}

export default {
  // 元の OpenNext の fetch ハンドラをそのまま引き継ぐ
  fetch: openNextWorker.fetch,

  // Cloudflare Cron Triggers 用のハンドラ
  async scheduled(controller, env, ctx) {
    const path = CRON_ROUTES[controller.cron];

    if (!path) {
      console.error("Cron triggered with unmapped schedule:", controller.cron);
      return;
    }

    console.log(`Cron triggered (${controller.cron}): invoking ${path}`);
    await invokeCronRoute(path, env, ctx);
  }
};
