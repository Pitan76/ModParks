import type { TranslationDeps } from "@modparks/core/translation/service";
import { toTranslationSettings } from "@modparks/core/translation/settings";
import { createWorkersAiProvider, WORKERS_AI_PROVIDER } from "@modparks/core/translation/providers/workersAi";
import type { TranslationProvider } from "@modparks/core/translation/providers/types";
import type { AiBinding } from "@modparks/core/db/client";
import { getAppSettings } from "@/lib/config/readSettings";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Database } from "@/lib/db";

/**
 * 翻訳の部品（Next 側のアダプタ）。本体は core/translation にあり、ここは
 * AI の束縛・アプリ設定・回数制限をアンビエントに解決して渡すだけ。
 */
async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

async function getAiBinding(): Promise<AiBinding> {
  const ai = ((await getWorkerEnv()) as { AI?: AiBinding }).AI;
  if (!ai) throw new Error("AI binding not found (add [ai] to wrangler.toml)");
  return ai;
}

/** プロバイダの差し替えは TRANSLATION_PROVIDER の値と、この表への追加だけで済む */
const PROVIDERS: Record<string, TranslationProvider> = {
  [WORKERS_AI_PROVIDER]: createWorkersAiProvider(getAiBinding),
};

function getTranslationProvider(): TranslationProvider {
  const name = process.env.TRANSLATION_PROVIDER || WORKERS_AI_PROVIDER;
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown translation provider: ${name}`);
  return provider;
}

export function nextTranslationDeps(db: Database): TranslationDeps {
  return {
    db,
    getSettings: async () => toTranslationSettings(await getAppSettings()),
    provider: getTranslationProvider(),
    rateLimit: (action, limit, windowMs, userId) => checkRateLimit(action, limit, windowMs, userId),
  };
}
