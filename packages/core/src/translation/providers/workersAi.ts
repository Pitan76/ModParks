/**
 * Workers AI を使う翻訳プロバイダ。外部 API キーを持たずに済むため初期実装に採用する。
 */
import { buildSystemPrompt, buildUserPrompt } from "@modparks/core/translation/prompt";
import type { AiBinding } from "@modparks/core/db/client";
import type { TranslationProvider, TranslationRequest } from "@modparks/core/translation/providers/types";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const WORKERS_AI_PROVIDER = "workers-ai";

/**
 * @param getAi AI の束縛。環境から取るものなので呼び出し側が渡す（使うときだけ解決する）
 */
export const createWorkersAiProvider = (getAi: () => Promise<AiBinding>): TranslationProvider => ({
  name:         WORKERS_AI_PROVIDER,
  defaultModel: DEFAULT_MODEL,

  async translate(req: TranslationRequest): Promise<string> {
    const ai = await getAi();
    const result = await ai.run(req.model, {
      messages: [
        { role: "system", content: buildSystemPrompt(req.sourceLocale, req.targetLocale, req.strict) },
        { role: "user", content: buildUserPrompt(req) },
      ],
      // 訳文のぶれと記法崩れを抑えるため、生成はできるだけ決定的にする
      temperature: 0.1,
      // 既定の出力上限では応答が途中で切れる。塊の文字数に見合う値にすること。
      // 課金は生成した分だけだが、暴走生成で無料枠を溶かさないための上限でもある
      max_tokens: req.maxTokens,
    });
    if (typeof result.response !== "string") throw new Error("Workers AI returned no response");
    return result.response;
  },
});
