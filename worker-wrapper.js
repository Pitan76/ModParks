import openNextWorker from "./.open-next/worker.js";

export default {
  // 元の OpenNext の fetch ハンドラをそのまま引き継ぐ
  fetch: openNextWorker.fetch,

  // Cloudflare Cron Triggers 用のハンドラ
  async scheduled(controller, env, ctx) {
    console.log("Cron triggered: Executing scheduled background sync...");

    // Next.js の内部 API Route へ疑似リクエストを発行する
    // ホスト名は localhost で問題なく、openNextWorker.fetch がルーティングを処理します
    const url = "http://localhost/api/cron/sync-external";
    const req = new Request(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${env.CRON_SECRET || ""}`
      }
    });

    try {
      const res = await openNextWorker.fetch(req, env, ctx);
      if (res.ok) {
        const data = await res.json();
        console.log("Cron sync processed successfully:", data);
      } else {
        console.error("Cron sync failed with status:", res.status, await res.text());
      }
    } catch (e) {
      console.error("Cron fetch error:", e);
    }
  }
};
