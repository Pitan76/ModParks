import { describe, expect, it } from "vitest";
import app from "../workers/api/src/index";
import type { ApiWorkerEnv } from "../workers/api/src/env";

/**
 * modparks-api をそのまま叩く結合テスト。
 *
 * ここで確かめるのは DB に触れる前に決まる振る舞い（CSRF・未ログイン・
 * ルーティング）だけ。env の DB は触られないことを前提にした空のもの。
 */
const ORIGIN = "https://modparks.pitan76.net";
const env = {
  NEXT_PUBLIC_APP_URL: ORIGIN,
  AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
} as unknown as ApiWorkerEnv;

function call(method: string, path: string, headers: Record<string, string> = {}) {
  return app.request(`${ORIGIN}${path}`, { method, headers }, env);
}

describe("PATCH /api/app/projects/:id", () => {
  it("他サイトからの要求は 403（CSRF）", async () => {
    const res = await call("PATCH", "/api/app/projects/p1", { origin: "https://evil.example" });

    expect(res.status).toBe(403);
  });

  it("Content-Type が JSON でも他サイトからなら 403", async () => {
    const res = await call("PATCH", "/api/app/projects/p1", {
      origin: "https://evil.example",
      "content-type": "application/json",
    });

    expect(res.status).toBe(403);
  });

  it("自サイトからでもセッションが無ければ 401", async () => {
    const res = await call("PATCH", "/api/app/projects/p1", { origin: ORIGIN });

    expect(res.status).toBe(401);
  });

  it("壊れたセッション Cookie でも 401（500 にしない）", async () => {
    const res = await call("PATCH", "/api/app/projects/p1", {
      origin: ORIGIN,
      cookie: "__Secure-authjs.session-token=garbage",
    });

    expect(res.status).toBe(401);
  });
});

describe("ルーティング", () => {
  it("実装のあるパスへの許可外メソッドは 405・空ボディ（Next と同じ）", async () => {
    const res = await call("GET", "/api/app/projects/p1");

    expect(res.status).toBe(405);
    expect(await res.text()).toBe("");
  });

  it("/api/app/ 配下の存在しないパスは 404（この Worker の専有なので未実装ではない）", async () => {
    expect((await call("GET", "/api/app/nope")).status).toBe(404);
  });

  it("ルートパターンが拾った実装外のパスは 501（設定のずれを明示する）", async () => {
    expect((await call("GET", "/api/v2/ideas")).status).toBe(501);
  });

  it("/api/v2/projects への許可外メソッドは 405", async () => {
    expect((await call("POST", "/api/v2/projects")).status).toBe(405);
  });
});

describe("設定漏れ", () => {
  it("AUTH_SECRET が無ければ 500 ではなく 503 と原因を返す", async () => {
    const noSecret = { NEXT_PUBLIC_APP_URL: ORIGIN } as unknown as ApiWorkerEnv;
    const res = await app.request(`${ORIGIN}/api/app/projects/p1`, { method: "PATCH", headers: { origin: ORIGIN } }, noSecret);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "AUTH_SECRET is not configured on modparks-api" });
  });
});

describe("GET /api/app/session", () => {
  it("セッションが無ければ 401", async () => {
    expect((await call("GET", "/api/app/session")).status).toBe(401);
  });
});

describe("GET /api/app/collections", () => {
  it("セッションが無ければ 401。userId を渡しても他人の一覧は返さない", async () => {
    const res = await call("GET", "/api/app/collections?userId=victim&viewerId=victim");

    expect(res.status).toBe(401);
  });
});

describe("コレクションの Server Action", () => {
  it("非公開コレクションを読める関数が 'use server' から export されていない", async () => {
    // import すると next-auth 経由で Next の実行環境が要るので、ソースを静的に読む
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/lib/actions/collection.ts", import.meta.url), "utf8");

    expect(src.trimStart().startsWith('"use server"')).toBe(true);
    for (const name of ["getUserCollections", "getUserCollectionsWithProjectStatus", "getCollectionById"]) {
      // 「(」まで含めて探す。getUserCollections が getUserCollectionsWithProjectStatus の
      // 先頭一致で引っかからないように
      expect(src).not.toContain(`function ${name}(`);
    }
  });
});
