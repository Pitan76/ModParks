"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import TranslateIcon from "@mui/icons-material/Translate";
import { useTranslations } from "next-intl";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import { useTranslateRequest } from "./useTranslateRequest";

interface Content {
  body: string;
  format: string;
}

interface TranslatedDescriptionProps {
  postId: string;
  locale: string;
  /** 原文。訳文を表示していても切り替えで戻せるよう常に持つ */
  original: Content;
  /** 保存済みの訳文。無ければ null */
  translation: Content | null;
  state: "cached" | "manual" | null;
  stale: boolean;
  /** 訳文が無い、または古い場合に AI 翻訳を実行できるか */
  canTranslate: boolean;
  isLoggedIn: boolean;
}

/**
 * 説明文の表示と、原文 / 訳文の切り替え。
 * 訳文が既にあれば最初からそちらを出し、リンクで原文に戻せるようにする。
 */
export default function TranslatedDescription(props: TranslatedDescriptionProps) {
  const t = useTranslations("Project.translation");
  const [translation, setTranslation] = useState<Content | null>(props.translation);
  const [showOriginal, setShowOriginal] = useState(false);
  const { run, loading, error } = useTranslateRequest();

  const onTranslate = async () => {
    const result = await run(props.postId, props.locale);
    if (!result) return;
    setTranslation({ body: result.body, format: result.bodyFormat });
    setShowOriginal(false);
  };

  const showingTranslation = translation !== null && !showOriginal;
  const content = showingTranslation ? translation : props.original;

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        {translation !== null && (
          <>
            <TranslateIcon fontSize="small" color="action" />
            <Link component="button" type="button" underline="hover" onClick={() => setShowOriginal(!showOriginal)}>
              {showingTranslation ? t("showOriginal") : t("showTranslation")}
            </Link>
          </>
        )}

        {props.canTranslate && (
          <>
            {translation === null && <TranslateIcon fontSize="small" color="action" />}
            {props.isLoggedIn ? (
              <Link component="button" type="button" underline="hover" onClick={onTranslate} disabled={loading}>
                {translation === null ? t("translateLink") : t("retranslate")}
              </Link>
            ) : (
              <Typography variant="body2" color="text.secondary">{t("loginRequired")}</Typography>
            )}
          </>
        )}

        {loading && <CircularProgress size={16} />}
      </Box>

      {props.stale && props.state === "manual" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("manualStaleNotice")}
        </Typography>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>{t(`errors.${error}`)}</Typography>
      )}

      <DescriptionRenderer content={content.body} format={content.format} />

      {showingTranslation && props.state !== "manual" && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          {t("machineTranslated")}
        </Typography>
      )}
    </Box>
  );
}
