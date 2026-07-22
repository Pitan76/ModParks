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

/** 失敗時のレスポンス。成功時は各 Result 型がそのまま返る。 */
export interface JarWorkerError {
  error: string;
}
