import JSZip from "jszip";
import type { ScanFinding, ScanJarResult, ScanLevel } from "./types";

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

/** URL のホスト部が生IPのもの。ドメインを使わない通信先は隠蔽の疑いが強い */
const RAW_IP_URL = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/;

/** 定数プール走査の総バイト上限。巨大な Mod で CPU 時間を使い切らないための打ち切り */
const CLASS_SCAN_BUDGET_BYTES = 12 * 1024 * 1024;

const endsWithAny = (name: string, exts: string[]) => {
  const lower = name.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
};

/** zip slip: 展開先をアーカイブ外へ逃がすエントリ名 */
const isPathTraversal = (name: string) =>
  name.startsWith("/") || name.includes("../") || /^[a-zA-Z]:[\\/]/.test(name);

/** エントリ名から判定できる兆候を集める */
function checkEntryNames(zip: Zip): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const name of Object.keys(zip.files)) {
    if (isPathTraversal(name)) {
      findings.push({ rule: "pathTraversal", level: "malicious", target: name });
      continue;
    }
    if (endsWithAny(name, EXECUTABLE_EXTS)) {
      findings.push({ rule: "embeddedExecutable", level: "malicious", target: name });
      continue;
    }
    if (endsWithAny(name, NATIVE_LIB_EXTS)) {
      findings.push({ rule: "nativeLibrary", level: "suspicious", target: name });
    }
  }

  return findings;
}

/** MANIFEST.MF の Class-Path が外部URLを指していないか */
async function checkManifest(zip: Zip): Promise<ScanFinding[]> {
  const entry = zip.file("META-INF/MANIFEST.MF");
  if (!entry) return [];

  const content = await entry.async("string");
  // 継続行（先頭スペース）を畳んでから読む。MANIFEST は72バイトで折り返される
  const unfolded = content.replace(/\r?\n /g, "");
  const classPath = unfolded.match(/^Class-Path:\s*(.+)$/m)?.[1] ?? "";

  if (!/https?:\/\//.test(classPath)) return [];
  return [{ rule: "remoteClassPath", level: "malicious", target: classPath.trim().slice(0, 200) }];
}

/** .class の定数プールを ASCII として走査し、危険トークンを探す */
async function checkClassTokens(zip: Zip): Promise<ScanFinding[]> {
  const decoder = new TextDecoder("latin1");
  const findings: ScanFinding[] = [];
  const seenRules = new Set<string>();
  let budget = CLASS_SCAN_BUDGET_BYTES;

  const classEntries = zip.file(/\.class$/);

  for (const entry of classEntries) {
    if (budget <= 0) break;

    const bytes = await entry.async("uint8array");
    budget -= bytes.byteLength;
    const text = decoder.decode(bytes);

    for (const token of RISKY_TOKENS) {
      if (seenRules.has(token) || !text.includes(token)) continue;
      seenRules.add(token);
      findings.push({ rule: `riskyApi:${token}`, level: "suspicious", target: entry.name });
    }

    const rawIp = text.match(RAW_IP_URL);
    if (rawIp && !seenRules.has("rawIpUrl")) {
      seenRules.add("rawIpUrl");
      findings.push({ rule: "rawIpUrl", level: "suspicious", target: `${entry.name} (${rawIp[0]})` });
    }
  }

  return findings;
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

  const [nameFindings, manifestFindings, tokenFindings] = await Promise.all([
    Promise.resolve(checkEntryNames(zip)),
    checkManifest(zip),
    checkClassTokens(zip),
  ]);

  const findings = [...nameFindings, ...manifestFindings, ...tokenFindings];
  return { level: aggregateLevel(findings), findings };
}
