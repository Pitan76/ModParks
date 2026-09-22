import { createJarClient } from "@modparks/core/jar/client";
import type { JarSource, ParsedModInfo, ExtractRecipesResult, ScanJarResult } from "@modparks/core/jar/types";

export type { JarSource, ParsedModInfo, ExtractRecipesResult, ScanJarResult };

/**
 * modparks-jar Worker のクライアント（Next 側のアダプタ）。
 *
 * 本体は core/jar/client.ts にあり、ここは Service Binding をアンビエントに
 * 解決して渡すだけ。既存の呼び出し元（parseModJar などを直接 import している）の
 * ために同じ名前で公開している。
 */
async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");

  return (await getCloudflareContext({ async: true })).env;
}

async function getJarWorker(): Promise<Fetcher> {
  const jar = ((await getWorkerEnv()) as { JAR?: Fetcher }).JAR;
  if (!jar) throw new Error("JAR service binding not found (deploy modparks-jar first)");

  return jar;
}

/** Next のリクエスト中に使う JarClient */
export const nextJarClient = createJarClient(getJarWorker);

export const parseModJar = nextJarClient.parseModJar;
export const extractRecipes = nextJarClient.extractRecipes;
export const scanJar = nextJarClient.scanJar;
