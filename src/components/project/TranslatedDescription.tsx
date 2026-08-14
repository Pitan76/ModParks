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

interface TranslatedDescriptionProps {
  postId: string;
  locale: string;
  body: string;
  bodyFormat: string;
  /** 表示中の本文が訳文か */
  translated: boolean;
  state: "cached" | "manual" | null;
  stale: boolean;
  canTranslate: boolean;
  isLoggedIn: boolean;
}

/**
 * 説明文の表示と、閲覧者主導の AI 翻訳。
 * 訳文は取得後にこの場で差し替える（cached を SSR に載せないため）。
 */
export default function TranslatedDescription(props: TranslatedDescriptionProps) {
  const t = useTranslations("Project.translation");
  const [content, setContent] = useState({ body: props.body, format: props.bodyFormat });
  // 訳文を出しているのは manual のときだけ。cached はこの画面での取得後に差し替わる
  const [done, setDone] = useState(props.translated);
  const { run, loading, error } = useTranslateRequest();

  const onTranslate = async () => {
    const result = await run(props.postId, props.locale);
    if (!result) return;
    setContent({ body: result.body, format: result.bodyFormat });
    setDone(true);
  };

  return (
    <Box>
      {props.canTranslate && !done && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <TranslateIcon fontSize="small" color="action" />
          {props.isLoggedIn ? (
            <Link component="button" type="button" onClick={onTranslate} disabled={loading} underline="hover">
              {props.stale ? t("retranslate") : t("translateLink")}
            </Link>
          ) : (
            <Typography variant="body2" color="text.secondary">{t("loginRequired")}</Typography>
          )}
          {loading && <CircularProgress size={16} />}
        </Box>
      )}

      {props.stale && props.state === "manual" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("manualStaleNotice")}
        </Typography>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>{t(`errors.${error}`)}</Typography>
      )}

      <DescriptionRenderer content={content.body} format={content.format} />

      {done && props.state !== "manual" && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          {t("machineTranslated")}
        </Typography>
      )}
    </Box>
  );
}
