import type {
  ExtractRecipesRequest,
  ExtractRecipesResult,
  JarSource,
  ParseModRequest,
  ParsedModInfo,
  ScanJarRequest,
  ScanJarResult,
} from "@/workers/jar/src/types";

export type { JarSource, ParsedModInfo, ExtractRecipesResult, ScanJarResult };

/**
 * modparks-jar Worker のクライアント。
 *
 * JAR 解析には jszip が必要だが、これをメインアプリに載せると Worker の
 * 3 MiB 制限を超えるため、解析処理はサイドカー Worker に隔離している。
 * ここは Service Binding 越しの呼び出しだけを担い、jszip を一切参照しない。
 */
async function getJarWorker(): Promise<Fetcher> {
  const env = await getWorkerEnv();
  const jar = (env as unknown as { JAR?: Fetcher }).JAR;
  if (!jar) throw new Error("JAR service binding not found (deploy modparks-jar first)");
  return jar;
}

async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

/** Service Binding に POST し、JSON を返す。Worker 側のエラーは例外として伝播させる。 */
async function callJarWorker<T>(path: string, body: unknown): Promise<T> {
  const jar = await getJarWorker();
  const res = await jar.fetch(`https://modparks-jar${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || `jar worker returned ${res.status}`);
  return payload;
}

/** JAR からバージョン・対応ローダー・対応MCバージョンを検出する */
export function parseModJar(source: JarSource): Promise<ParsedModInfo> {
  return callJarWorker<ParsedModInfo>("/parse-mod", { source } satisfies ParseModRequest);
}

/** JAR からレシピ類を抽出し、CDN または R2 へアップロードする */
export function extractRecipes(
  source: JarSource,
  cdnUrl: string,
  useCdnApi: boolean
): Promise<ExtractRecipesResult> {
  return callJarWorker<ExtractRecipesResult>("/extract-recipes", {
    source,
    cdnUrl,
    useCdnApi,
  } satisfies ExtractRecipesRequest);
}

/** JAR をヒューリスティックに検査し、マルウェア的な構造の兆候を返す */
export function scanJar(source: JarSource): Promise<ScanJarResult> {
  return callJarWorker<ScanJarResult>("/scan-jar", { source } satisfies ScanJarRequest);
}
