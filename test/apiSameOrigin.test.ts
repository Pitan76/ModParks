import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "../workers/api/src/sameOrigin";

const APP = "https://modparks.pitan76.net";

function req(method: string, headers: Record<string, string>) {
  return new Request(`${APP}/api/x`, { method, headers });
}

describe("isSameOriginRequest", () => {
  it("安全なメソッドは Origin が無くても通す", () => {
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(isSameOriginRequest(req(m, {}), APP)).toBe(true);
  });

  it("自サイトの Origin なら変更系を通す", () => {
    expect(isSameOriginRequest(req("PATCH", { origin: APP }), APP)).toBe(true);
  });

  it("他サイトの Origin なら変更系を拒否する", () => {
    expect(isSameOriginRequest(req("POST", { origin: "https://evil.example" }), APP)).toBe(false);
  });

  it("Content-Type が JSON でも検査する（hono/csrf と違い素通りさせない）", () => {
    const r = req("POST", { origin: "https://evil.example", "content-type": "application/json" });

    expect(isSameOriginRequest(r, APP)).toBe(false);
  });

  it("サブドメインは別オリジンとして拒否する", () => {
    expect(isSameOriginRequest(req("DELETE", { origin: "https://evil.pitan76.net" }), APP)).toBe(false);
  });

  it("http と https は別オリジンとして拒否する", () => {
    expect(isSameOriginRequest(req("POST", { origin: "http://modparks.pitan76.net" }), APP)).toBe(false);
  });

  it("Origin が無くても Sec-Fetch-Site: same-origin なら通す", () => {
    expect(isSameOriginRequest(req("POST", { "sec-fetch-site": "same-origin" }), APP)).toBe(true);
  });

  it("Origin も Sec-Fetch-Site も無い変更系は拒否する", () => {
    expect(isSameOriginRequest(req("POST", {}), APP)).toBe(false);
  });

  it("Sec-Fetch-Site が cross-site なら拒否する", () => {
    expect(isSameOriginRequest(req("POST", { "sec-fetch-site": "cross-site" }), APP)).toBe(false);
  });

  it("Origin が一致しなければ Sec-Fetch-Site では救わない", () => {
    // Origin がある以上はそちらを正とする。食い違う要求を通さない
    const r = req("POST", { origin: "https://evil.example", "sec-fetch-site": "same-origin" });

    expect(isSameOriginRequest(r, APP)).toBe(false);
  });
});
