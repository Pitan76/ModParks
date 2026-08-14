"use client";

import { useState } from "react";

export interface TranslateResponse {
  title: string;
  body: string;
  bodyFormat: string;
  cached: boolean;
}

/** /api/translate の呼び出し。エラーはキーで返し、文言は呼び出し側で翻訳する */
export function useTranslateRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (postId: string, locale: string): Promise<TranslateResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ postId, locale }),
      });
      const data = (await res.json()) as Partial<TranslateResponse> & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "provider_error");
        return null;
      }
      return data as TranslateResponse;
    } catch {
      // ネットワーク境界。失敗しても原文表示は維持されるため画面は壊れない
      setError("provider_error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error };
}
