import type { Context } from "hono";
import { listTrustedDeviceSummaries } from "@modparks/core/auth/trustedDeviceList";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { readCookie } from "../cookies";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/** Next 側の lib/auth/trustedDevice.ts と同じ名前 */
const TRUSTED_DEVICE_COOKIE = "mp_trusted_device";

/**
 * GET /api/app/trusted-devices — 本人の信頼済みデバイス一覧。
 *
 * 設定画面がマウント時に読む。以前は Server Action で、中の auth() がセッション
 * Cookie を書き直すため、開くたびに画面の再取得が 1 回余計に走っていた。
 */
export async function getTrustedDevices(c: Ctx): Promise<Response> {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const devices = await listTrustedDeviceSummaries(auth.db, auth.userId, readCookie(c.req.raw, TRUSTED_DEVICE_COOKIE));

  return c.json(devices, 200, { "Cache-Control": "private, no-store" });
}
