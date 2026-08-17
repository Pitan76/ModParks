import { describe, expect, it } from "vitest";
import { selectVersionTargets } from "@/lib/externalSync/versionTargets";
import { applyMcVersionOperation } from "@/lib/externalSync/mcVersionOps";

type V = { name: string; loaders: string[]; at: number };

const opts = (platforms: string[], targetVersions: "all" | "latest") => ({
  loadersOf: (v: V) => v.loaders,
  publishedAtOf: (v: V) => v.at,
  platforms,
  targetVersions,
});

const fabricOld: V = { name: "fabric-old", loaders: ["fabric"], at: 1 };
const fabricNew: V = { name: "fabric-new", loaders: ["fabric"], at: 3 };
const forgeOld: V = { name: "forge-old", loaders: ["forge"], at: 2 };
const forgeNew: V = { name: "forge-new", loaders: ["forge"], at: 4 };
const items = [fabricOld, forgeOld, fabricNew, forgeNew];

describe("selectVersionTargets", () => {
  it("ローダー未指定なら絞り込まない", () => {
    expect(selectVersionTargets(items, opts([], "all"))).toEqual(items);
  });

  it("ローダー未指定の latest は全体の最新1件", () => {
    expect(selectVersionTargets(items, opts([], "latest"))).toEqual([forgeNew]);
  });

  it("ローダー指定時の latest は指定ローダーごとの最新を選ぶ", () => {
    const picked = selectVersionTargets(items, opts(["fabric", "forge"], "latest"));
    expect(picked).toHaveLength(2);
    expect(picked.map((v) => v.name).sort()).toEqual(["fabric-new", "forge-new"]);
  });

  it("片方のローダーだけ指定すればそのローダーの最新だけ", () => {
    expect(selectVersionTargets(items, opts(["fabric"], "latest"))).toEqual([fabricNew]);
  });

  it("all はローダーに一致する全件", () => {
    expect(selectVersionTargets(items, opts(["fabric"], "all"))).toEqual([fabricOld, fabricNew]);
  });

  it("大文字小文字と余分な空白は無視して突き合わせる", () => {
    expect(selectVersionTargets(items, opts([" Fabric "], "latest"))).toEqual([fabricNew]);
  });

  it("複数ローダー対応のバージョンは重複して選ばれない", () => {
    const multi: V = { name: "multi", loaders: ["fabric", "forge"], at: 9 };
    expect(selectVersionTargets([...items, multi], opts(["fabric", "forge"], "latest"))).toEqual([multi]);
  });

  it("一致するものが無ければ空", () => {
    expect(selectVersionTargets(items, opts(["neoforge"], "latest"))).toEqual([]);
    expect(selectVersionTargets([], opts([], "latest"))).toEqual([]);
  });
});

describe("applyMcVersionOperation", () => {
  it("add は既存を保って重複なく足す", () => {
    expect(applyMcVersionOperation(["1.21.1"], "add", ["1.21.2", "1.21.1"])).toEqual(["1.21.1", "1.21.2"]);
  });

  it("remove は指定分だけ取り除く（部分削除）", () => {
    expect(applyMcVersionOperation(["1.21.1", "1.21.2", "1.21.3"], "remove", ["1.21.2"])).toEqual(["1.21.1", "1.21.3"]);
  });

  it("set は全置換", () => {
    expect(applyMcVersionOperation(["1.21.1", "1.21.2"], "set", ["1.20.1"])).toEqual(["1.20.1"]);
  });
});
