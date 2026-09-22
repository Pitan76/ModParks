import type { Context } from "hono";
import type { Database } from "@modparks/core/db/client";
import type { UserNotifyContext } from "@modparks/core/notifications/dispatch";
import type { ApiWorkerEnv } from "./env";
import { pushSenderFrom } from "./push";
import { notificationMessage } from "./notificationMessage";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * ユーザー宛て通知の送り手（modparks-api 側）。Next 側の userNotifyContext と対。
 *
 * Discord への送信は応答の後も走らせたいので waitUntil に預ける。Workers では
 * 応答を返した時点で、預けていない処理は打ち切られうるため。
 */
export function userNotifyContextFor(c: Ctx, db: Database): UserNotifyContext {
  return {
    db,
    push: pushSenderFrom(c.env),
    message: notificationMessage,
    defer: (task) => c.executionCtx.waitUntil(task),
  };
}

/**
 * core が返した結果を応答にする。
 *
 * 本文は Server Action の戻り値と同じ形のまま返す。画面側が戻り値の扱いを
 * 変えずに済むようにするため。成功は 200、入力や権限の誤りなど「処理した結果として
 * 失敗した」ものは 422 にする（画面側は両方を結果として受け取る）。
 */
export function respond(c: Ctx, result: object): Response {
  const failed = "error" in result || ("success" in result && result.success === false);

  return c.json(result, failed ? 422 : 200, { "Cache-Control": "private, no-store" });
}
