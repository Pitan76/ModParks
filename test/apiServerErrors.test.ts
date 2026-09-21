import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLocale, serverErrorsFor } from "../workers/api/src/serverErrors";
import ja from "../src/lang/ja_jp.json";
import en from "../src/lang/en_us.json";

const APP = "https://modparks.pitan76.net/api/app/x";

function req(cookie?: string) {
  return new Request(APP, cookie ? { headers: { cookie } } : undefined);
}

/** core 配下で ServerErrorTranslator に渡しているキーを集める */
function keysUsedInCore(): string[] {
  const root = join(__dirname, "../packages/core/src");
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".ts")) {
        // 翻訳関数は慣例で t と名付けて受け取っている
        for (const m of readFileSync(path, "utf8").matchAll(/\bt\("([\w.]+)"\)/g)) keys.add(m[1]);
      }
    }
  };
  walk(root);

  return [...keys];
}

function has(tree: unknown, key: string): boolean {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === "string";
}

describe("resolveLocale", () => {
  it("NEXT_LOCALE Cookie の言語を使う", () => {
    expect(resolveLocale(req("NEXT_LOCALE=en"))).toBe("en");
  });

  it("他の Cookie に混ざっていても拾う", () => {
    expect(resolveLocale(req("a=1; NEXT_LOCALE=en; b=2"))).toBe("en");
  });

  it("Cookie が無ければ既定の ja", () => {
    expect(resolveLocale(req())).toBe("ja");
  });

  it("未知の言語は既定の ja", () => {
    expect(resolveLocale(req("NEXT_LOCALE=fr"))).toBe("ja");
  });
});

describe("serverErrorsFor", () => {
  it("要求の言語で翻訳済みの文字列を返す", () => {
    expect(serverErrorsFor(req("NEXT_LOCALE=ja"))("project.slugTaken")).toBe(ja.ServerErrors.project.slugTaken);
    expect(serverErrorsFor(req("NEXT_LOCALE=en"))("project.slugTaken")).toBe(en.ServerErrors.project.slugTaken);
  });

  it("キーではなく翻訳済みの文字列を返す（Server Action と同じ系統）", () => {
    expect(serverErrorsFor(req())("project.slugTaken")).not.toBe("project.slugTaken");
  });
});

describe("翻訳漏れ", () => {
  const keys = keysUsedInCore();

  it("core で使っているキーを 1 つ以上見つけられる（この検査自体が空振りしていない）", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it.each(keys)("%s が ja と en の両方にある", (key) => {
    expect(has(ja.ServerErrors, key)).toBe(true);
    expect(has(en.ServerErrors, key)).toBe(true);
  });
});
