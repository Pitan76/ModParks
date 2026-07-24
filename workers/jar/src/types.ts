/**
 * modparks-jar Worker の入出力契約。
 *
 * このファイルは型のみを持ち、実装や依存を一切含まない。
 * メインアプリは `import type` でここを参照するため、jszip がメイン側の
 * バンドルに混入しないことがこのファイルの純粋性によって担保される。
 */

/** 解析対象 JAR の所在。バイト列を跨がせず、Worker 側に取得させる。 */
export type JarSource =
  | { kind: "r2"; key: string }
  | { kind: "url"; url: string };

/** JAR から検出した Mod のバージョン情報 */
export interface ParsedModInfo {
  detectedVersion: string;
  detectedLoaders: string[];
  detectedMcVersions: string[];
}

export interface ParseModRequest {
  source: JarSource;
}

export interface ExtractRecipesRequest {
  source: JarSource;
  cdnUrl: string;
  /** true なら CDN の bulk API へ、false ならバインディング経由で R2 へ直接書く */
  useCdnApi: boolean;
}

export interface ExtractRecipesResult {
  count: number;
  namespaces: string[];
}

/**
 * スキャン結果の判定。
 * - clean:      検出なし
 * - suspicious: 誤検知しうる兆候。DLは止めず警告のみ
 * - malicious:  誤検知しにくい明確な兆候。DLを止める
 */
export type ScanLevel = "clean" | "suspicious" | "malicious";

/** スキャンで検出した1件。message は表示用の説明ではなく検出対象の実体を入れる。 */
export interface ScanFinding {
  /** 検出ルールの識別子。表示文言は呼び出し側で i18n する */
  rule: string;
  level: Exclude<ScanLevel, "clean">;
  /** 検出箇所（zipエントリ名など） */
  target: string;
}

export interface ScanJarRequest {
  source: JarSource;
}

export interface ScanJarResult {
  level: ScanLevel;
  findings: ScanFinding[];
}

/** 失敗時のレスポンス。成功時は各 Result 型がそのまま返る。 */
export interface JarWorkerError {
  error: string;
}
