import type { TranslationError } from "@modparks/core/translation/service";

/** エラー種別ごとの HTTP ステータス。文言はクライアント側で翻訳する */
export const TRANSLATION_ERROR_STATUS: Record<TranslationError, number> = {
  invalid_locale: 400,
  not_found:      404,
  not_public:     403,
  rate_limited:   429,
  too_long:       413,
  cooling_down:   429,
  invalid_output: 502,
  provider_error: 502,
  budget_exceeded: 429,
  translation_disabled: 403,
  feature_disabled:     503,
};
