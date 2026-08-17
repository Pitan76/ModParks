import { describe, expect, it } from "vitest";
import { dedupeTags } from "@/lib/utils/versionRecord";

describe("dedupeTags", () => {
  it("重複を落とす（複合主キー違反で取り込み全体が落ちるのを防ぐ）", () => {
    expect(dedupeTags(["fabric", "fabric"])).toEqual(["fabric"]);
    expect(dedupeTags(["1.20.1", "1.20.1", "1.21"])).toEqual(["1.20.1", "1.21"]);
  });

  it("空文字と空白だけの値を落とす", () => {
    expect(dedupeTags(["fabric", "", "   "])).toEqual(["fabric"]);
  });

  it("前後の空白を落としたうえで同一視する", () => {
    expect(dedupeTags([" fabric", "fabric "])).toEqual(["fabric"]);
  });

  it("並び順は保つ（表示順が解析結果と食い違わないように）", () => {
    expect(dedupeTags(["neoforge", "fabric", "neoforge"])).toEqual(["neoforge", "fabric"]);
  });

  it("空配列はそのまま", () => {
    expect(dedupeTags([])).toEqual([]);
  });
});
