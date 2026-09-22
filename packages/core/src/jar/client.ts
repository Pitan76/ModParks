import type {
  ExtractBuildInfo,
  ExtractRecipesRequest,
  ExtractRecipesResult,
  JarSource,
  ParseModRequest,
  ParsedModInfo,
  ScanJarRequest,
  ScanJarResult,
} from "@modparks/core/jar/types";

/**
 * modparks-jar Worker のクライアント。
 *
 * JAR 解析には jszip が必要で、これを載せると isolate 起動時の評価 CPU が増えるため、
 * 解析処理はサイドカー Worker に隔離している。ここは Service Binding 越しの呼び出しだけを
 * 担い、jszip を一切参照しない。Service Binding は環境から取るものなので受け取る
 * （Next は getCloudflareContext、modparks-api は env.JAR）。
 */
export type JarClient = {
  /** JAR からバージョン・対応ローダー・対応MCバージョンを検出する */
  parseModJar(source: JarSource): Promise<ParsedModInfo>;
  /** JAR からレシピ類を抽出し、CDN または R2 へアップロードする */
  extractRecipes(source: JarSource, cdnUrl: string, useCdnApi: boolean, build?: ExtractBuildInfo): Promise<ExtractRecipesResult>;
  /** JAR をヒューリスティックに検査し、マルウェア的な構造の兆候を返す */
  scanJar(source: JarSource): Promise<ScanJarResult>;
};

/**
 * Service Binding から JarClient を作る。
 * @param getJar 呼ぶたびに解決する。Next 側は取得が非同期で失敗もしうるため関数で受ける
 */
export function createJarClient(getJar: () => Promise<Fetcher>): JarClient {
  /** Service Binding に POST し、JSON を返す。Worker 側のエラーは例外として伝播させる */
  async function call<T>(path: string, body: unknown): Promise<T> {
    const res = await (await getJar()).fetch(`https://modparks-jar${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(payload.error || `jar worker returned ${res.status}`);

    return payload;
  }

  return {
    parseModJar: (source) => call("/parse-mod", { source } satisfies ParseModRequest),
    extractRecipes: (source, cdnUrl, useCdnApi, build) =>
      call("/extract-recipes", { source, cdnUrl, useCdnApi, build } satisfies ExtractRecipesRequest),
    scanJar: (source) => call("/scan-jar", { source } satisfies ScanJarRequest),
  };
}
