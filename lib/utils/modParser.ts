import JSZip from "jszip";
import { parse as parseToml } from "smol-toml";
import semver from "semver";
import { MC_VERSIONS } from "@/lib/validations";
import { AVAILABLE_LOADERS } from "@/lib/loaders";

export interface ParsedModInfo {
  detectedVersion: string;
  detectedLoaders: string[];
  detectedMcVersions: string[];
}

/**
 * JAR/ZIPファイルを解析し、Mod/Pluginのバージョン情報、対応ローダー、対応MCバージョンを抽出します。
 */
export async function parseModJar(file: File): Promise<ParsedModInfo> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  let detectedVersion = "";
  let detectedLoaders: string[] = [];
  let detectedMcVersions: string[] = [];

  // 1. Check fabric.mod.json
  const fabricJson = loadedZip.file("fabric.mod.json");
  if (fabricJson) {
    const content = await fabricJson.async("string");
    try {
      const parsed = JSON.parse(content);
      if (parsed.version && !parsed.version.includes("${")) detectedVersion = parsed.version;
      detectedLoaders.push("fabric");
      
      const mcDep = parsed.depends?.minecraft;
      if (mcDep) {
        let ranges: string[] = [];
        if (typeof mcDep === "string") ranges.push(mcDep);
        else if (Array.isArray(mcDep)) ranges.push(...mcDep);

        const satisfying = MC_VERSIONS.filter(v => ranges.some(range => {
          try {
            return semver.satisfies(v + (v.split(".").length === 2 ? ".0" : ""), range);
          } catch (e) {
            return v === range || range.includes(v);
          }
        }));
        detectedMcVersions.push(...satisfying);
      }
    } catch (e) { console.error("Failed to parse fabric.mod.json", e); }
  }

  // 2. Check META-INF/mods.toml (Forge)
  const forgeToml = loadedZip.file("META-INF/mods.toml");
  if (forgeToml) {
    const content = await forgeToml.async("string");
    try {
      const parsed: any = parseToml(content);
      if (parsed.mods && parsed.mods[0]) {
        const modVersion = parsed.mods[0].version;
        if (modVersion && !modVersion.includes("${")) {
          detectedVersion = modVersion;
        }
      }
      detectedLoaders.push("forge");
      
      if (parsed.dependencies) {
         const deps = Object.values(parsed.dependencies).flat() as any[];
         const mcDep = deps.find(d => d.modId === "minecraft");
         if (mcDep && mcDep.versionRange) {
           MC_VERSIONS.forEach(v => {
             if (mcDep.versionRange.includes(v)) detectedMcVersions.push(v);
           });
         }
      }
    } catch (e) { console.error("Failed to parse mods.toml", e); }
  }

  // 3. Check META-INF/neoforge.mods.toml
  const neoToml = loadedZip.file("META-INF/neoforge.mods.toml");
  if (neoToml) {
    const content = await neoToml.async("string");
    try {
      const parsed: any = parseToml(content);
      if (parsed.mods && parsed.mods[0]) {
        const modVersion = parsed.mods[0].version;
        if (modVersion && !modVersion.includes("${")) {
          detectedVersion = modVersion;
        }
      }
      detectedLoaders.push("neoforge");
      
      if (parsed.dependencies) {
         const deps = Object.values(parsed.dependencies).flat() as any[];
         const mcDep = deps.find(d => d.modId === "minecraft");
         if (mcDep && mcDep.versionRange) {
           MC_VERSIONS.forEach(v => {
             if (mcDep.versionRange.includes(v)) detectedMcVersions.push(v);
           });
         }
      }
    } catch (e) { console.error("Failed to parse neoforge.mods.toml", e); }
  }

  // Filter valid loaders only
  const validLoaders = detectedLoaders.filter(l => AVAILABLE_LOADERS.includes(l));

  return {
    detectedVersion,
    detectedLoaders: Array.from(new Set(validLoaders)),
    detectedMcVersions: Array.from(new Set(detectedMcVersions)),
  };
}
