import { Hono, type Context } from "hono";
import { getDb } from "@modparks/core/db/client";
import { handleListProjects } from "@modparks/core/api/v2/projects";
import type { ApiWorkerEnv } from "./env";
import { sameOrigin } from "./sameOrigin";
import { patchProject } from "./routes/projects";
import { getSession } from "./routes/session";
import { getMyCollections } from "./routes/collections";
import { getTrustedDevices } from "./routes/trustedDevices";
import * as ideaRoutes from "./routes/ideas";
import * as versionRoutes from "./routes/versions";
import * as projectSettingsRoutes from "./routes/projectSettings";
import * as dependencyRoutes from "./routes/dependencies";

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

/**
 * このWorkerが受け持つパス。メソッド不許可(405)と未実装(501)を
 * 区別するために使う。Next 側は許可外メソッドへ 405 を返すので、
 * 引き取ったパスでも同じ応答にしないと API の互換性が崩れる。
 */
const SERVED_PATHS = new Set(["/api/v2/projects"]);

app.get("/api/v2/projects", (c) =>
  handleListProjects({ db: getDb(c.env.DB), kv: c.env.SETTINGS_KV }, c.req.raw)
);

/**
 * /api/app/* はブラウザ（自サイトのページ）から Cookie のセッションで呼ぶ API。
 * 公開 API(/api/v1, /api/v2) と違い Server Action の置き換えなので、
 * 変更系は必ず要求元が自サイトであることを確かめる（CSRF 対策）。
 *
 * この接頭辞の下には Next のルートを置かない約束にしている。そうすれば
 * wrangler.toml でワイルドカード(/api/app/*)を使っても、Next のルートを
 * 奪う事故が構造的に起きない。
 */
const appOrigin = (env: unknown) => new URL((env as ApiWorkerEnv).NEXT_PUBLIC_APP_URL).origin;
app.use("/api/app/*", sameOrigin(appOrigin));
app.get("/api/app/session", getSession);
app.get("/api/app/collections", getMyCollections);
app.get("/api/app/trusted-devices", getTrustedDevices);
app.patch("/api/app/projects/:id", patchProject);
app.patch("/api/app/projects/:id/description", projectSettingsRoutes.patchDescription);
app.patch("/api/app/projects/:id/icon", projectSettingsRoutes.patchIcon);
app.post("/api/app/projects/:id/transfer", projectSettingsRoutes.postTransfer);
app.post("/api/app/projects/:id/media", projectSettingsRoutes.postMedia);
app.patch("/api/app/media/:id", projectSettingsRoutes.patchMedia);
app.delete("/api/app/media/:id", projectSettingsRoutes.deleteMedia);
app.post("/api/app/projects/:id/members", projectSettingsRoutes.postMember);
app.delete("/api/app/projects/:id/members/:userId", projectSettingsRoutes.deleteMember);
app.post("/api/app/projects/:id/dependencies", dependencyRoutes.postDependency);
app.delete("/api/app/dependencies/:id", dependencyRoutes.deleteDependency);

app.post("/api/app/ideas", ideaRoutes.postIdea);
app.patch("/api/app/ideas/:id", ideaRoutes.patchIdea);
app.delete("/api/app/ideas/:id", ideaRoutes.deleteIdea);
app.patch("/api/app/ideas/:id/status", ideaRoutes.patchIdeaStatus);
app.post("/api/app/ideas/:id/comments", ideaRoutes.postIdeaComment);
app.patch("/api/app/idea-comments/:id", ideaRoutes.patchIdeaComment);
app.delete("/api/app/idea-comments/:id", ideaRoutes.deleteIdeaComment);
app.post("/api/app/posts/:id/favorite", ideaRoutes.postFavorite);

// 固定パスの batch-mc-versions を :id より先に登録する
app.post("/api/app/projects/:slug/versions", versionRoutes.postVersion);
app.post("/api/app/projects/:slug/versions/batch-mc-versions", versionRoutes.postBatchMcVersions);
app.patch("/api/app/projects/:slug/versions/:id", versionRoutes.patchVersion);
app.delete("/api/app/projects/:slug/versions/:id", versionRoutes.deleteVersion);
app.patch("/api/app/projects/:slug/versions/:id/archive", versionRoutes.patchVersionArchive);
app.post("/api/app/projects/:slug/github-import", versionRoutes.postGithubImport);

// 上に無いメソッドは 405。登録順に照合されるので、実装の後ろに置く
const methodNotAllowed = (c: Context) => c.body(null, 405);
for (const path of [
  "/api/app/projects/:id",
  "/api/app/projects/:id/description",
  "/api/app/projects/:id/icon",
  "/api/app/projects/:id/transfer",
  "/api/app/projects/:id/media",
  "/api/app/media/:id",
  "/api/app/projects/:id/members",
  "/api/app/projects/:id/members/:userId",
  "/api/app/projects/:id/dependencies",
  "/api/app/dependencies/:id",
  "/api/app/ideas",
  "/api/app/ideas/:id",
  "/api/app/ideas/:id/status",
  "/api/app/ideas/:id/comments",
  "/api/app/idea-comments/:id",
  "/api/app/posts/:id/favorite",
  "/api/app/projects/:slug/versions",
  "/api/app/projects/:slug/versions/batch-mc-versions",
  "/api/app/projects/:slug/versions/:id",
  "/api/app/projects/:slug/versions/:id/archive",
  "/api/app/projects/:slug/github-import",
]) {
  app.all(path, methodNotAllowed);
}

/**
 * 取りこぼしの受け皿。
 *
 * 受け持つパスへの許可外メソッドは 405（Next 側の挙動に合わせる）。
 * それ以外は wrangler.toml のルートパターンと実装がズレている状態なので、
 * 404 で黙らせず 501 で明示して落とす。
 */
app.all("*", (c) => {
  const path = new URL(c.req.url).pathname;
  // Next のルートハンドラは 405 を空ボディで返す。実測して合わせている
  if (SERVED_PATHS.has(path)) return c.body(null, 405);
  // /api/app/* はこの Worker の専有なので、Next へ回る余地は無い。単に存在しない
  if (path.startsWith("/api/app/")) return c.json({ error: "Not Found" }, 404);

  return c.json(
    { error: "not_implemented", error_description: `${c.req.method} ${path} is not served by modparks-api` },
    501
  );
});

export default app;
