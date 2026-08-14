/**
 * Workers AI を使う翻訳プロバイダ。外部 API キーを持たずに済むため初期実装に採用する。
 */
import { buildSystemPrompt, buildUserPrompt } from "../prompt";
import type { AiBinding } from "@/lib/db";
import type { TranslationProvider, TranslationRequest } from "./types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const workersAiProvider: TranslationProvider = {
  name:  "workers-ai",
  model: MODEL,

  async translate(req: TranslationRequest): Promise<string> {
    const ai = await getAiBinding();
    const result = await ai.run(MODEL, {
      messages: [
        { role: "system", content: buildSystemPrompt(req.sourceLocale, req.targetLocale) },
        { role: "user", content: buildUserPrompt(req) },
      ],
      // 訳文のぶれと記法崩れを抑えるため、生成はできるだけ決定的にする
      temperature: 0.1,
    });
    if (typeof result.response !== "string") throw new Error("Workers AI returned no response");
    return result.response;
  },
};

async function getAiBinding(): Promise<AiBinding> {
  const env = await getWorkerEnv();
  const ai = (env as { AI?: AiBinding }).AI;
  if (!ai) throw new Error("AI binding not found (add [ai] to wrangler.toml)");
  return ai;
}

async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}
