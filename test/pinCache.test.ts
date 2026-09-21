import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPinCache, readPinCacheFetchedAt, writePinCache } from "../src/components/pin/pinCache";

/** node 環境には window が無いので、localStorage だけ差し込む */
function installStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  });
  return map;
}

describe("pinCache", () => {
  let map: Map<string, string>;
  beforeEach(() => {
    map = installStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("書いた内容を同じユーザーで読める", () => {
    writePinCache("u1", new Set(["project:a", "idea:b"]));

    expect(readPinCache("u1")).toEqual(new Set(["project:a", "idea:b"]));
  });

  it("別ユーザーの控えは使わない（同じブラウザでのアカウント切替）", () => {
    writePinCache("u1", new Set(["project:a"]));

    expect(readPinCache("u2")).toBeNull();
  });

  it("1 時間を過ぎた控えは使わない", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    writePinCache("u1", new Set(["project:a"]));

    vi.setSystemTime(new Date("2026-09-22T00:59:00Z"));
    expect(readPinCache("u1")).not.toBeNull();

    vi.setSystemTime(new Date("2026-09-22T01:01:00Z"));
    expect(readPinCache("u1")).toBeNull();
  });

  it("toggle で書き戻しても取得時刻は延ばさない", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    writePinCache("u1", new Set(["project:a"]));

    vi.setSystemTime(new Date("2026-09-22T00:50:00Z"));
    writePinCache("u1", new Set(["project:a", "project:b"]), readPinCacheFetchedAt());

    // 書き戻しから 10 分でも、元の取得から 1 時間を超えたら取り直す
    vi.setSystemTime(new Date("2026-09-22T01:01:00Z"));
    expect(readPinCache("u1")).toBeNull();
  });

  it("壊れた控えは例外にせず null", () => {
    map.set("pins_cache", "{not json");

    expect(readPinCache("u1")).toBeNull();
  });

  it("ストレージが例外を投げても落ちない", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    });

    expect(() => writePinCache("u1", new Set(["x"]))).not.toThrow();
    expect(readPinCache("u1")).toBeNull();
  });
});
