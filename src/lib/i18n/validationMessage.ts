"use client";

import { useTranslations } from "next-intl";
import { VALIDATION_KEY_PREFIX } from "@/lib/validationKeys";

/**
 * フォームのエラーメッセージ配列を表示用の文字列へ解決するフック。
 * {@link VALIDATION_KEY_PREFIX} が付いたものだけ翻訳し、それ以外は素通しする。
 */
export function useValidationMessage(): (messages?: string[]) => string | undefined {
  const t = useTranslations("Validation");

  return (messages) => {
    const message = messages?.[0];
    if (!message) return undefined;
    if (!message.startsWith(VALIDATION_KEY_PREFIX)) return message;
    return t(message.slice(VALIDATION_KEY_PREFIX.length) as never);
  };
}
