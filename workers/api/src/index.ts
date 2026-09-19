import { Hono } from "hono";
import { getDb } from "@modparks/core/db/client";
import { handleListProjects } from "@modparks/core/api/v2/projects";
import type { ApiWorkerEnv } from "./env";

/**
 * 公開 API を Next.js から切り離して処理する Worker。
 *
 * Free プランの CPU 上限は 1 リクエスト 10 ms しかない。OpenNext 経由だと
 * React を一切使わない API 要求でも isolate 起動時に Next のバンドル全体の
 * 評価を負担するため、そのぶんを丸ごと外すのが狙い。
 *
 * ハンドラ本体は packages/core にあり、Next 側のルートハンドラと共有している。
 * ここはバインディングを env から取り出して core へ渡すだけに留めること。
 */
const app = new Hono<{ Bindings: ApiWorkerEnv }>();

app.get("/api/v2/projects", (c) =>
  handleListProjects({ db: getDb(c.env.DB), kv: c.env.SETTINGS_KV }, c.req.raw)
);

/**
 * ルートパターンで拾ったのに実装が無いパス。
 *
 * 取りこぼしを 404 で黙って返すと本体にあるエンドポイントが消えたように
 * 見えるため、wrangler.toml のパターンと実装のズレを明示して落とす。
 */
app.all("*", (c) =>
  c.json(
    { error: "not_implemented", error_description: `${c.req.method} ${new URL(c.req.url).pathname} is not served by modparks-api` },
    501
  )
);

export default app;
