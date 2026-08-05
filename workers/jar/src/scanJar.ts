import JSZip from "jszip";
import type { ScanFinding, ScanJarResult, ScanLevel } from "./types";
import { MAX_ENTRY_BYTES, uncompressedSize } from "./limits";

type Zip = Awaited<ReturnType<JSZip["loadAsync"]>>;

/** JAR に同梱される正当な理由がまず無い実行ファイル */
const EXECUTABLE_EXTS = [".exe", ".msi", ".bat", ".cmd", ".ps1", ".scr", ".vbs", ".jar.exe"];

/** ネイティブライブラリ。LWJGL 同梱など正当な例があるため malicious にはしない */
const NATIVE_LIB_EXTS = [".dll", ".so", ".dylib"];

/**
 * クラス定数プールに現れると外部コード実行・動的ロードの疑いがあるトークン。
 * 単体では正当な用途もあるため suspicious 止まりとする。
 */
const RISKY_TOKENS = [
  "java/lang/Runtime",
  "java/lang/ProcessBuilder",
  "java/net/URLClassLoader",
  "javax/script/ScriptEngineManager",
  "defineClass",
];

const RISKY_TOKEN_PATTERNS = RISKY_TOKENS.map((token) => ({
  token,
  regex: new RegExp(token.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "(?![a-zA-Z0-9_/$])"),
}));

/** URL のホスト部が生IPのもの。ドメインを使わない通信先は隠蔽の疑いが強い */
const RAW_IP_URL = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/;

/** 定数プール走査の総バイト上限。巨大な Mod で CPU 時間を使い切らないための打ち切り */
const CLASS_SCAN_BUDGET_BYTES = 12 * 1024 * 1024;

/** Jar-in-Jar を追う深さ。Fabric の JiJ は1階層で足りる */
const MAX_NEST_DEPTH = 1;

function endsWithAny(name: string, exts: string[]) {
  const lower = name.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
}

/** zip slip: 展開先をアーカイブ外へ逃がすエントリ名 */
function isPathTraversal(name: string) {
  // 区切りを正規化しないと "..\evil" のような Windows 形式を取りこぼす
  const normalized = name.replace(/\\/g, "/");
  return (
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    /^[a-zA-Z]:\//.test(normalized)
  );
}

/** 展開後サイズ。JSZip は内部にしか持たないため取れなければ未知として扱う */
/**
 * 1回のスキャン全体で共有する状態。
 * Jar-in-Jar を潜っても走査予算と「同じルールは1回だけ報告する」を跨いで効かせる。
 */
type ScanState = {
  budget: number;
  seenRules: Set<string>;
};

/** ネストした jar の中の検出箇所を "outer.jar!/inner" 形式で表す */
function withPrefix(prefix: string, name: string) {
  return prefix ? `${prefix}!/${name}` : name;
}

/** エントリ名から判定できる兆候を集める */
function checkEntryNames(zip: Zip, prefix: string): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const rawName of Object.keys(zip.files)) {
    const name = withPrefix(prefix, rawName);
    if (isPathTraversal(rawName)) {
      findings.push({ rule: "pathTraversal", level: "malicious", target: name });
      continue;
    }
    if (endsWithAny(rawName, EXECUTABLE_EXTS)) {
      findings.push({ rule: "embeddedExecutable", level: "malicious", target: name });
      continue;
    }
    if (endsWithAny(rawName, NATIVE_LIB_EXTS)) {
      findings.push({ rule: "nativeLibrary", level: "suspicious", target: name });
    }
  }

  return findings;
}

/** MANIFEST.MF の Class-Path が外部URLを指していないか */
async function checkManifest(zip: Zip, prefix: string): Promise<ScanFinding[]> {
  const entry = zip.file("META-INF/MANIFEST.MF");
  if (!entry) return [];

  const content = await entry.async("string");
  // 継続行（先頭スペース）を畳んでから読む。MANIFEST は72バイトで折り返される
  const unfolded = content.replace(/\r?\n /g, "");
  const classPath = unfolded.match(/^Class-Path:\s*(.+)$/m)?.[1] ?? "";

  if (!/https?:\/\//.test(classPath)) return [];
  return [{
    rule: "remoteClassPath",
    level: "malicious",
    target: withPrefix(prefix, classPath.trim().slice(0, 200)),
  }];
}

/** .class の定数プールを ASCII として走査し、危険トークンを探す */
async function checkClassTokens(zip: Zip, state: ScanState, prefix: string): Promise<ScanFinding[]> {
  const decoder = new TextDecoder("latin1");
  const findings: ScanFinding[] = [];

  const classEntries = zip.file(/\.class$/);

  for (const entry of classEntries) {
    if (state.budget <= 0) break;
    // 展開前にサイズを見て弾く。読んでから引くと 1 エントリで予算を踏み越えられる
    const size = uncompressedSize(entry);
    if (size !== undefined && size > MAX_ENTRY_BYTES) continue;

    const bytes = await entry.async("uint8array");
    state.budget -= bytes.byteLength;
    const text = decoder.decode(bytes);
    const target = withPrefix(prefix, entry.name);

    for (const { token, regex } of RISKY_TOKEN_PATTERNS) {
      if (state.seenRules.has(token) || !text.includes(token)) continue;
      if (!regex.test(text)) continue;
      state.seenRules.add(token);
      findings.push({ rule: `riskyApi:${token}`, level: "suspicious", target });
    }

    const rawIp = text.match(RAW_IP_URL);
    if (rawIp && !state.seenRules.has("rawIpUrl")) {
      state.seenRules.add("rawIpUrl");
      findings.push({ rule: "rawIpUrl", level: "suspicious", target: `${target} (${rawIp[0]})` });
    }
  }

  return findings;
}

/**
 * 同梱された jar（Fabric の Jar-in-Jar など）を開いて同じ検査を適用する。
 *
 * JiJ 自体は正当な仕組みなので存在を検出とはせず、中身だけを見る。
 * ここを見ないと `.class` 走査を素通りできてしまうため、検査の穴を塞ぐ意味が大きい。
 */
async function checkNestedJars(
  zip: Zip,
  state: ScanState,
  prefix: string,
  depth: number
): Promise<ScanFinding[]> {
  if (depth >= MAX_NEST_DEPTH) return [];

  const findings: ScanFinding[] = [];

  for (const entry of zip.file(/\.jar$/)) {
    if (state.budget <= 0) break;
    const size = uncompressedSize(entry);
    if (size !== undefined && size > MAX_ENTRY_BYTES) continue;

    const bytes = await entry.async("uint8array");
    state.budget -= bytes.byteLength;

    try {
      const nested = await new JSZip().loadAsync(bytes);
      findings.push(...await scanZip(nested, state, withPrefix(prefix, entry.name), depth + 1));
    } catch {
      // 壊れた・暗号化された同梱 jar。展開できないこと自体は判定材料にしない
    }
  }

  return findings;
}

/** 1つの zip に対する全検査。ネストした jar からも同じ入口で呼ぶ */
async function scanZip(
  zip: Zip,
  state: ScanState,
  prefix: string,
  depth: number
): Promise<ScanFinding[]> {
  const nameFindings = checkEntryNames(zip, prefix);
  const manifestFindings = await checkManifest(zip, prefix);
  const tokenFindings = await checkClassTokens(zip, state, prefix);
  const nestedFindings = await checkNestedJars(zip, state, prefix, depth);

  return [...nameFindings, ...manifestFindings, ...tokenFindings, ...nestedFindings];
}

/** 最も重い検出結果を全体の判定とする */
function aggregateLevel(findings: ScanFinding[]): ScanLevel {
  if (findings.some((f) => f.level === "malicious")) return "malicious";
  if (findings.length > 0) return "suspicious";
  return "clean";
}

/**
 * JAR をヒューリスティックに検査する。
 *
 * シグネチャ型のマルウェア判定ではなく「Mod として不自然な構造」を拾う方針。
 * 誤検知を前提に、DLを止めるのは malicious のみに絞っている。
 */
export async function scanJar(file: ArrayBuffer | Uint8Array): Promise<ScanJarResult> {
  const zip = await new JSZip().loadAsync(file);
  const state: ScanState = { budget: CLASS_SCAN_BUDGET_BYTES, seenRules: new Set() };

  const findings = await scanZip(zip, state, "", 0);
  return { level: aggregateLevel(findings), findings };
}
