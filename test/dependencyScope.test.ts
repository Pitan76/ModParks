import { describe, expect, it } from "vitest";
import { dependencyAppliesToLoaders, parseDependencyLoaders } from "@/lib/dependencies/scope";
import { dependencyDraftsSchema } from "@/lib/validations";

describe("parseDependencyLoaders", () => {
  it("null / 空文字 / 空配列は指定なし扱い", () => {
    expect(parseDependencyLoaders(null)).toEqual([]);
    expect(parseDependencyLoaders("")).toEqual([]);
    expect(parseDependencyLoaders("[]")).toEqual([]);
  });

  it("JSON 文字列と配列のどちらでも開ける", () => {
    expect(parseDependencyLoaders('["fabric","quilt"]')).toEqual(["fabric", "quilt"]);
    expect(parseDependencyLoaders(["forge"])).toEqual(["forge"]);
  });

  it("壊れた値は指定なしに倒す（前提MODを出し損ねるより余分に出す）", () => {
    expect(parseDependencyLoaders("{not json")).toEqual([]);
  });

  it("空文字の要素は落とす", () => {
    expect(parseDependencyLoaders('["fabric",""]')).toEqual(["fabric"]);
  });
});

describe("dependencyAppliesToLoaders", () => {
  it("プラットフォーム指定が無ければ、どのバージョンにも要る", () => {
    expect(dependencyAppliesToLoaders([], ["fabric"])).toBe(true);
    expect(dependencyAppliesToLoaders([], [])).toBe(true);
  });

  it("指定が重なれば要る", () => {
    expect(dependencyAppliesToLoaders(["fabric"], ["fabric", "forge"])).toBe(true);
    expect(dependencyAppliesToLoaders(["fabric", "quilt"], ["quilt"])).toBe(true);
  });

  it("指定が重ならなければ要らない", () => {
    expect(dependencyAppliesToLoaders(["fabric"], ["forge"])).toBe(false);
  });

  it("ローダーを持たないバージョン（リソースパック等）には、指定付きの依存は出さない", () => {
    expect(dependencyAppliesToLoaders(["fabric"], [])).toBe(false);
  });
});

describe("dependencyDraftsSchema", () => {
  it("プロジェクト指定と外部URL指定のどちらも通る", () => {
    const parsed = dependencyDraftsSchema.safeParse([
      { dependencyType: "required", targetSlug: "fabric-api" },
      { dependencyType: "optional", externalName: "Sodium", externalUrl: "https://modrinth.com/mod/sodium", loaders: ["fabric"] },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("依存先が無いものは弾く", () => {
    const parsed = dependencyDraftsSchema.safeParse([{ dependencyType: "required" }]);
    expect(parsed.success).toBe(false);
  });

  it("名前だけで URL の無い外部依存は弾く", () => {
    const parsed = dependencyDraftsSchema.safeParse([{ dependencyType: "required", externalName: "Sodium" }]);
    expect(parsed.success).toBe(false);
  });

  it("知らない種別は弾く", () => {
    const parsed = dependencyDraftsSchema.safeParse([{ dependencyType: "whatever", targetSlug: "x" }]);
    expect(parsed.success).toBe(false);
  });
});
