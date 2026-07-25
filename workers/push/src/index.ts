import type { PushWorkerEnv } from "./env";
import type { SendRequest, SendResult } from "./types";
import { deliverPush } from "./webpush";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** POST /send : 1 購読へ 1 通知を送る（暗号化+VAPID署名+配送） */
async function handleSend(req: Request): Promise<SendResult> {
  const b = (await req.json()) as SendRequest;
  const r = await deliverPush(b.subscription, b.payload, b.vapid, b.ttl ?? 2419200);
  return { ok: r.ok, status: r.status, expired: r.expired, ...(r.error ? { error: r.error } : {}) };
}

const ROUTES: Record<string, (req: Request) => Promise<unknown>> = {
  "/send": handleSend,
};

const worker = {
  async fetch(req: Request, _env: PushWorkerEnv): Promise<Response> {
    const handler = ROUTES[new URL(req.url).pathname];
    if (!handler) return json({ error: "Not found" }, 404);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      return json(await handler(req));
    } catch (e) {
      console.error("push worker failed:", e);
      return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
    }
  },
};

export default worker;
