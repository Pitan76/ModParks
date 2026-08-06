"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslations } from "next-intl";

export type FileHashChipProps = {
  /** SHA-256 のヘックス文字列。null/空なら何も描画しない（外部URL配信のバージョン等） */
  sha256: string | null | undefined;
};

/** ハッシュの先頭・末尾のみを残した省略表記を返す */
const shorten = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`;

/**
 * バージョンのファイル SHA-256 を省略表示し、クリップボードへコピーできるようにする。
 * ユーザーがダウンロードしたファイルを自分で照合できるようにするための表示。
 */
const FileHashChip = ({ sha256 }: FileHashChipProps) => {
  const t = useTranslations("Project");
  const [copied, setCopied] = useState(false);

  if (!sha256) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sha256);
    } catch {
      return; // クリップボード拒否時は表示を変えない
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
        SHA-256
      </Typography>
      <Tooltip title={sha256}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {shorten(sha256)}
        </Typography>
      </Tooltip>
      <Tooltip title={copied ? t("hashCopied") : t("copyHash")}>
        <IconButton size="small" aria-label={t("copyHash")} onClick={copy} sx={{ p: 0.25 }}>
          {copied ? (
            <CheckIcon sx={{ fontSize: 12, color: "success.main" }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 12, color: "text.disabled" }} />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default FileHashChip;
