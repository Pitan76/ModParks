import { describe, expect, it } from "vitest";
import { mergeDependencyEntries, mergeDependentEntries } from "@/lib/dependencies/merge";
import type { DependencyEntry } from "@modparks/core/dependencies/entryTypes";

const entry = (over: Partial<DependencyEntry> & { id: string }): DependencyEntry => ({
  dependencyType: "required",
  project: { id: "p1", slug: "fabric-api", title: "Fabric API", iconUrl: null },
  externalUrl: null,
  externalName: null,
  versionId: null,
  versionNumber: null,
  loaders: [],
  ...over,
});

describe("mergeDependencyEntries", () => {
  it("プラットフォーム別の行を1件にまとめ、ローダーを和集合にする", () => {
    const merged = mergeDependencyEntries([
      entry({ id: "a", loaders: ["fabric"] }),
      entry({ id: "b", loaders: ["quilt"] }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].loaders).toEqual(["fabric", "quilt"]);
  });

  it("片方が全プラットフォームなら全プラットフォームに倒す", () => {
    const merged = mergeDependencyEntries([
      entry({ id: "a", loaders: ["fabric"] }),
      entry({ id: "b", loaders: [] }),
    ]);

    expect(merged[0].loaders).toEqual([]);
  });

  it("対象バージョンが割れたらバージョン限定ではなくなる", () => {
    const merged = mergeDependencyEntries([
      entry({ id: "a", versionId: "v1", versionNumber: "1.0.0" }),
      entry({ id: "b", versionId: "v2", versionNumber: "2.0.0" }),
    ]);

    expect(merged[0].versionId).toBeNull();
    expect(merged[0].versionNumber).toBeNull();
  });

  it("同じバージョン限定どうしはバージョン表示を保つ", () => {
    const merged = mergeDependencyEntries([
      entry({ id: "a", versionId: "v1", versionNumber: "1.0.0", loaders: ["fabric"] }),
      entry({ id: "b", versionId: "v1", versionNumber: "1.0.0", loaders: ["forge"] }),
    ]);

    expect(merged[0].versionNumber).toBe("1.0.0");
  });

  it("依存の種別が違えば別件のまま残す", () => {
    const merged = mergeDependencyEntries([
      entry({ id: "a" }),
      entry({ id: "b", dependencyType: "optional" }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("外部依存はURLで同一判定する", () => {
    const external = (id: string, url: string) =>
      entry({ id, externalUrl: url, externalName: "Fabric API", project: { id, slug: id, title: "Fabric API", iconUrl: null } });

    const merged = mergeDependencyEntries([
      external("a", "https://modrinth.com/mod/fabric-api"),
      external("b", "https://modrinth.com/mod/fabric-api"),
      external("c", "https://modrinth.com/mod/sodium"),
    ]);

    expect(merged).toHaveLength(2);
  });
});

describe("mergeDependentEntries", () => {
  it("同じプロジェクトからの被依存は1件にまとめる", () => {
    const dependent = (id: string, projectId: string) => ({
      id,
      dependencyType: "required" as const,
      project: { id: projectId, slug: projectId, title: projectId, iconUrl: null },
    });

    const merged = mergeDependentEntries([dependent("a", "p1"), dependent("b", "p1"), dependent("c", "p2")]);

    expect(merged.map((d) => d.project.id)).toEqual(["p1", "p2"]);
  });
});
