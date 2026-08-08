"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Slide from "@mui/material/Slide";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

interface StickySaveBarProps {
  /** 未保存の変更があるとき true。false の間はバーごと隠れる */
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  /** 省略すると「破棄」ボタンを出さない */
  onDiscard?: () => void;
  /** 保存を止めたいとき（バリデーションエラーなど） */
  disabled?: boolean;
  message?: string;
}

/**
 * 設定系画面で共通して使う、未保存の変更があるときだけ浮き上がる保存バー。
 * 各画面に常設の「保存」「更新」ボタンを置く代わりにこれを使う。
 */
export default function StickySaveBar({
  open,
  saving = false,
  onSave,
  onDiscard,
  disabled = false,
  message,
}: StickySaveBarProps) {
  const t = useTranslations("Common");

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.modal - 1,
          display: "flex",
          justifyContent: "center",
          px: 2,
          pb: "calc(16px + env(safe-area-inset-bottom))",
          pointerEvents: "none",
        }}
      >
        <Paper
          elevation={8}
          sx={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: "100%",
            maxWidth: 640,
            px: 2,
            py: 1.25,
            borderRadius: 3,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {message ?? t("unsavedChanges")}
          </Typography>
          {onDiscard && (
            <Button size="small" color="inherit" onClick={onDiscard} disabled={saving}>
              {t("discard")}
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={onSave}
            disabled={saving || disabled}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </Paper>
      </Box>
    </Slide>
  );
}
