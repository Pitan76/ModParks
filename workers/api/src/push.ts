import { createPushSender, type PushSender } from "@modparks/core/notifications/pushSender";
import type { ApiWorkerEnv } from "./env";

/**
 * modparks-api 側の Web Push の送り手。Next 側（src/lib/services/push.ts）と対。
 *
 * 例外は投げない。Next 側は VAPID が未設定なら PUSH に触れずにスキップし、
 * PUSH が無ければ送信時に初めて失敗する（購読ごとに記録して握る）。同じ挙動に
 * 揃えておかないと、この Worker にだけ PUSH を設定し忘れた時に保存そのものが
 * 失敗してしまう。
 */
export function pushSenderFrom(env: ApiWorkerEnv): PushSender {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  const vapid = publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
  if (env.PUSH) return createPushSender(env.PUSH, vapid);

  return {
    vapid,
    send: async () => {
      throw new Error("PUSH service binding not found on modparks-api");
    },
  };
}
