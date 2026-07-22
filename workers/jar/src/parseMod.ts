import JSZip from "jszip";
import { parse as parseToml } from "smol-toml";
import semver from "semver";
import { MC_VERSIONS } from "../../../lib/data/minecraftVersions";
import { AVAILABLE_LOADERS } from "../../../lib/data/loaderIds";
import type { ParsedModInfo } from "./types";

/** ローダー検出器1つ分の結果。version は見つかった場合のみ。 */
interface Detection {
  loader: string;
  version?: string;
  mcVersions: string[];
}

type Zip = Awaited<ReturnType<JSZip["loadAsync"]>>;

/** ローダー記述子の最小形。値はいずれも信用できないため unknown で受ける。 */
interface FabricModJson {
  version?: unknown;
  depends?: { minecraft?: unknown };
}

interface TomlModsFile {
  mods?: { version?: unknown }[];
  dependencies?: Record<string, { modId?: string; versionRange?: string }[]>;
}

interface QuiltModJson {
  quilt_loader?: {
    version?: unknown;
    depends?: { id?: string; versions?: unknown }[];
  };
}

/** `${...}` を含むバージョンはビルド前のプレースホルダなので採用しない */
const isConcreteVersion = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && !v.includes("${");

/** MC_VERSIONS のうち、指定レンジ群を満たすものを返す（semver 不正なら部分一致で代替） */
function matchByRange(ranges: string[]): string[] {
  return MC_VERSIONS.filter((v) =>
    ranges.some((range) => {
      try {
        return semver.satisfies(v + (v.split(".").length === 2 ? ".0" : ""), range);
      } catch {
        return v === range || range.includes(v);
      }
    })
  );
}

/** MC_VERSIONS のうち、レンジ文字列に名前が含まれるものを返す（Forge 系の緩い表記向け） */
const matchBySubstring = (ranges: string[]): string[] =>
  MC_VERSIONS.filter((v) => ranges.some((r) => typeof r === "string" && r.includes(v)));

async function readJson<T>(zip: Zip, path: string): Promise<T | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  const content = await entry.async("string");
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    console.warn(`Invalid JSON in ${path}`, e);
    return null;
  }
}

async function readToml<T>(zip: Zip, path: string): Promise<T | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  const content = await entry.async("string");
  try {
    return parseToml(content) as T;
  } catch (e) {
    console.warn(`Invalid TOML in ${path}`, e);
    return null;
  }
}

async function detectFabric(zip: Zip): Promise<Detection | null> {
  const parsed = await readJson<FabricModJson>(zip, "fabric.mod.json");
  if (!parsed) return null;

  const mcDep = parsed.depends?.minecraft;
  const ranges = (typeof mcDep === "string" ? [mcDep] : Array.isArray(mcDep) ? mcDep : []).filter(
    (r): r is string => typeof r === "string"
  );

  return {
    loader: "fabric",
    version: isConcreteVersion(parsed.version) ? parsed.version : undefined,
    mcVersions: matchByRange(ranges),
  };
}

/** Forge / NeoForge は mods.toml の書式が共通なので検出器を共有する */
async function detectToml(zip: Zip, path: string, loader: string): Promise<Detection | null> {
  const parsed = await readToml<TomlModsFile>(zip, path);
  if (!parsed) return null;

  const modVersion = parsed.mods?.[0]?.version;
  const deps = Object.values(parsed.dependencies ?? {}).flat();
  const mcDep = deps.find((d) => d?.modId === "minecraft");

  return {
    loader,
    version: isConcreteVersion(modVersion) ? modVersion : undefined,
    mcVersions: mcDep?.versionRange ? matchBySubstring([mcDep.versionRange]) : [],
  };
}

async function detectQuilt(zip: Zip): Promise<Detection | null> {
  const parsed = await readJson<QuiltModJson>(zip, "quilt.mod.json");
  if (!parsed) return null;

  const ql = parsed.quilt_loader;
  const mcDep = ql?.depends?.find((d) => d?.id === "minecraft");
  const range = mcDep?.versions;
  const ranges = (Array.isArray(range) ? range : range ? [range] : []).filter(
    (r): r is string => typeof r === "string"
  );

  return {
    loader: "quilt",
    version: isConcreteVersion(ql?.version) ? String(ql.version) : undefined,
    mcVersions: matchBySubstring(ranges),
  };
}

async function detectBukkit(zip: Zip): Promise<Detection | null> {
  const entry = zip.file("plugin.yml");
  if (!entry) return null;
  const content = await entry.async("string");

  const versionMatch = content.match(/^version:\s*["']?([^"'\r\n]+)["']?/m);
  const version = versionMatch?.[1].trim();

  // api-version (例: 1.20) は「1.20 系全体に対応」を意味するため前方一致で展開する
  const api = content.match(/^api-version:\s*["']?([^"'\r\n]+)["']?/m)?.[1].trim();
  const mcVersions = api ? MC_VERSIONS.filter((v) => v === api || v.startsWith(api + ".")) : [];

  return {
    loader: "paper",
    version: isConcreteVersion(version) ? version : undefined,
    mcVersions,
  };
}

/**
 * JAR/ZIP を解析し、Mod のバージョン・対応ローダー・対応MCバージョンを抽出する。
 *
 * 複数のローダー記述子が同居する JAR があるため、全検出器を通して結果を統合する。
 * バージョンは後勝ち（元実装の挙動を踏襲）。
 */
export async function parseModJar(file: ArrayBuffer | Uint8Array): Promise<ParsedModInfo> {
  const zip = await new JSZip().loadAsync(file);

  const detections = await Promise.all([
    detectFabric(zip),
    detectToml(zip, "META-INF/mods.toml", "forge"),
    detectToml(zip, "META-INF/neoforge.mods.toml", "neoforge"),
    detectQuilt(zip),
    detectBukkit(zip),
  ]);

  let detectedVersion = "";
  const loaders: string[] = [];
  const mcVersions: string[] = [];

  for (const d of detections) {
    if (!d) continue;
    if (d.version) detectedVersion = d.version;
    loaders.push(d.loader);
    mcVersions.push(...d.mcVersions);
  }

  return {
    detectedVersion,
    detectedLoaders: [...new Set(loaders.filter((l) => AVAILABLE_LOADERS.includes(l)))],
    detectedMcVersions: [...new Set(mcVersions)],
  };
}
