import { describe, expect, it, vi } from "vitest";
import { encode } from "@auth/core/jwt";
import type { Database } from "@modparks/core/db/client";

// DB 判定は別途 isAccountActive 側の責務。ここでは結果だけ差し替える
const accountActive = vi.hoisted(() => ({ value: true }));
vi.mock("@modparks/core/auth/accountStatus", () => ({
  isAccountActive: vi.fn(async () => accountActive.value),
}));

import { readSession, readSessionUserId } from "../workers/api/src/session";

const SECRET = "test-secret-at-least-32-characters-long!!";
const SECURE_NAME = "__Secure-authjs.session-token";
const PLAIN_NAME = "authjs.session-token";
const db = {} as Database;

/** Auth.js と同じ方式（Cookie 名を salt にする）でトークンを作る */
async function issue(salt: string, token: Record<string, unknown>, secret = SECRET) {
  return encode({ token, secret, salt });
}

function req(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

describe("readSessionUserId", () => {
  it("https では __Secure- 付きの Cookie からユーザーIDを取り出す", async () => {
    const jwt = await issue(SECURE_NAME, { sub: "user-1" });
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=${jwt}` });

    expect(await readSessionUserId(r, SECRET)).toBe("user-1");
  });

  it("http では接頭辞の無い Cookie 名を使う", async () => {
    const jwt = await issue(PLAIN_NAME, { sub: "user-2" });
    const r = req("http://localhost:8787/x", { cookie: `${PLAIN_NAME}=${jwt}` });

    expect(await readSessionUserId(r, SECRET)).toBe("user-2");
  });

  it("sub が無いトークンでは id を使う（jwt コールバックが token.id を載せるため）", async () => {
    const jwt = await issue(SECURE_NAME, { id: "user-3" });
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=${jwt}` });

    expect(await readSessionUserId(r, SECRET)).toBe("user-3");
  });

  it("分割された Cookie(.0 .1)を再結合して読む", async () => {
    const jwt = await issue(SECURE_NAME, { sub: "user-4" });
    const half = Math.floor(jwt.length / 2);
    const cookie = `${SECURE_NAME}.0=${jwt.slice(0, half)}; ${SECURE_NAME}.1=${jwt.slice(half)}`;
    const r = req("https://modparks.pitan76.net/x", { cookie });

    expect(await readSessionUserId(r, SECRET)).toBe("user-4");
  });

  it("鍵が違えば復号できず null", async () => {
    const jwt = await issue(SECURE_NAME, { sub: "user-5" }, "another-secret-that-is-also-32-chars!!");
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=${jwt}` });

    expect(await readSessionUserId(r, SECRET)).toBeNull();
  });

  it("Cookie が無ければ null", async () => {
    expect(await readSessionUserId(req("https://modparks.pitan76.net/x", {}), SECRET)).toBeNull();
  });

  it("壊れた Cookie は例外にせず null", async () => {
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=not-a-jwt` });

    expect(await readSessionUserId(r, SECRET)).toBeNull();
  });

  it("Authorization ヘッダの JWT はセッションとして読まない", async () => {
    // getToken は Cookie が無いと Bearer を読みにいく。API キー / OAuth の経路と
    // 取り違えないよう、ここでは Cookie だけを渡している
    const jwt = await issue(SECURE_NAME, { sub: "attacker" });
    const r = req("https://modparks.pitan76.net/x", { authorization: `Bearer ${jwt}` });

    expect(await readSessionUserId(r, SECRET)).toBeNull();
  });
});

describe("readSession", () => {
  it("有効なアカウントなら返す", async () => {
    accountActive.value = true;
    const jwt = await issue(SECURE_NAME, { sub: "user-6" });
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=${jwt}` });

    expect(await readSession(db, r, SECRET)).toEqual({ userId: "user-6" });
  });

  it("トークンが有効でも、凍結・削除済みなら返さない", async () => {
    // トークンに isSuspended が載っていない（= Next 側の再検査前）状態でも弾けること
    accountActive.value = false;
    const jwt = await issue(SECURE_NAME, { sub: "user-7", isSuspended: false });
    const r = req("https://modparks.pitan76.net/x", { cookie: `${SECURE_NAME}=${jwt}` });

    expect(await readSession(db, r, SECRET)).toBeNull();
  });
});
