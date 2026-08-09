import { describe, expect, it } from "vitest";
import { parseModJar } from "../workers/jar/src/parseMod";
import JSZip from "jszip";

// テスト用のダミー JAR をオンメモリで生成するヘルパー
async function createDummyJar(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("parseModJar - mcVersions detection", () => {
  it("Forge mods.toml dependencies with ranges are parsed correctly", async () => {
    // [1.18, 1.19) の依存関係を持つ Forge のダミー mods.toml
    const modsToml = `
mods = [{ modId = "example", version = "0.0.7" }]
[[dependencies.example]]
    modId = "minecraft"
    versionRange = "[1.18,1.19)"
    ordering = "NONE"
    side = "BOTH"
`;
    const jar = await createDummyJar({
      "META-INF/mods.toml": modsToml,
    });

    const parsed = await parseModJar(jar);
    expect(parsed.detectedLoaders).toContain("forge");
    
    // 1.18, 1.18.1, 1.18.2 を含み、1.19 や 1.1 (誤検知) は含まないこと
    expect(parsed.detectedMcVersions).toContain("1.18.2");
    expect(parsed.detectedMcVersions).toContain("1.18.1");
    expect(parsed.detectedMcVersions).toContain("1.18");
    expect(parsed.detectedMcVersions).not.toContain("1.19");
    expect(parsed.detectedMcVersions).not.toContain("1.1");
  });

  it("Forge mods.toml with a single version dependency is parsed correctly", async () => {
    const modsToml = `
mods = [{ modId = "example", version = "0.0.7" }]
[[dependencies.example]]
    modId = "minecraft"
    versionRange = "[1.20.1]"
    ordering = "NONE"
    side = "BOTH"
`;
    const jar = await createDummyJar({
      "META-INF/mods.toml": modsToml,
    });

    const parsed = await parseModJar(jar);
    expect(parsed.detectedMcVersions).toEqual(["1.20.1"]);
  });
});
