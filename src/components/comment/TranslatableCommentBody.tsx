"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useLocale, useTranslations } from "next-intl";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import { detectSourceLocale } from "@modparks/core/translation/detectLocale";

interface TranslatableCommentBodyProps {
  commentId: string;
  content: string;
  format: string | null;
  isLoggedIn: boolean;
}

type Translation = { body: string; bodyFormat: string };

/** /api/translate/comment の呼び出し。@returns 失敗時はエラーキー */
async function fetchCommentTranslation(commentId: string, locale: string): Promise<Translation | { error: string }> {
  try {
    const res = await fetch("/api/translate/comment", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ commentId, locale }),
    });
    const data = (await res.json()) as Partial<Translation> & { error?: string };
    if (!res.ok) return { error: typeof data.error === "string" ? data.error : "provider_error" };

    return data as Translation;
  } catch {
    // ネットワーク境界。失敗しても原文表示は維持されるため画面は壊れない
    return { error: "provider_error" };
  }
}

/**
 * コメント本文と、AI 翻訳への切り替え。
 * 一覧の全コメントぶん訳文を先読みすると表示が重くなるため、閲覧者が押したものだけ取りに行く。
 * 表示ロケールと同じ言語で書かれたコメントには導線を出さない。
 */
export default function TranslatableCommentBody({ commentId, content, format, isLoggedIn }: TranslatableCommentBodyProps) {
  const t = useTranslations("Project.translation");
  const locale = useLocale();
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translatable = isLoggedIn && detectSourceLocale(content) !== locale;
  const showingTranslation = translation !== null && !showOriginal;

  const onClick = async () => {
    if (translation) return setShowOriginal(!showOriginal);

    setLoading(true);
    setError(null);
    const result = await fetchCommentTranslation(commentId, locale);
    setLoading(false);
    if ("error" in result) return setError(result.error);
    setTranslation(result);
  };

  return (
    <Box>
      <DescriptionRenderer
        content={showingTranslation ? translation.body : content}
        format={showingTranslation ? translation.bodyFormat : format}
      />
      {translatable && (
        <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Link component="button" type="button" variant="caption" underline="hover" onClick={onClick} disabled={loading}>
            {showingTranslation ? t("showOriginal") : t("showMachineTranslation")}
          </Link>
          {loading && <CircularProgress size={12} />}
          {error && <Typography variant="caption" color="error">{t(`errors.${error}`)}</Typography>}
        </Box>
      )}
    </Box>
  );
}
