/**
 * プロバイダの選択。差し替えは TRANSLATION_PROVIDER の値と、この表への追加だけで済む。
 */
import type { TranslationProvider } from "./types";
import { workersAiProvider } from "./workersAi";

const PROVIDERS: Record<string, TranslationProvider> = {
  [workersAiProvider.name]: workersAiProvider,
};

const DEFAULT_PROVIDER = workersAiProvider.name;

export function getTranslationProvider(): TranslationProvider {
  const name = process.env.TRANSLATION_PROVIDER || DEFAULT_PROVIDER;
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown translation provider: ${name}`);
  return provider;
}

export type { TranslationProvider, TranslationRequest } from "./types";
