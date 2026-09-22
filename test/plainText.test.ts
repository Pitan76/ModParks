import { describe, expect, it } from "vitest";
import { toPlainDescription } from "@modparks/core/utils/plainText";

describe("toPlainDescription の見出し", () => {
  it("# の見出しは省く", () => {
    expect(toPlainDescription("# Title\n本文")).toBe("本文");
  });

  it("=== で下線を引く見出しは、見出しの行も下線も省く", () => {
    expect(toPlainDescription("AAA\n========\n本文")).toBe("本文");
  });

  it("--- で下線を引く見出しも省く", () => {
    expect(toPlainDescription("AAA\n---\n本文")).toBe("本文");
  });

  it("空行の後の --- は区切り線なので、前の段落は残す", () => {
    expect(toPlainDescription("前の段落\n\n---\n本文")).toBe("前の段落 本文");
  });
});
