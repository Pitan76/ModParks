"use client";

import Typography from "@mui/material/Typography";
import DialogContentText from "@mui/material/DialogContentText";
import AbstractDialog from "@/components/ui/AbstractDialog";
import FormTextField from "@/components/ui/form/FormTextField";
import { useTranslations } from "next-intl";

export type AccountConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** ダイアログ見出し。退会・無効化それぞれの文言を渡す */
  title: string;
  /** 実行内容の説明文 */
  description: string;
  /** パスワード入力を促す文 */
  prompt: string;
  confirmText: string;
  /** 退会は error、一時無効化は warning */
  color: "error" | "warning";
  submitting: boolean;
  value: string;
  onChangeValue: (value: string) => void;
};

/**
 * アカウントの退会・一時無効化で共通して使う確認ダイアログ。
 *
 * どちらも「説明 → パスワード（または2FAトークン）入力 → 実行」の同じ流れで、
 * 違うのは文言と配色だけなので 1 つにまとめている。
 */
export default function AccountConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  prompt,
  confirmText,
  color,
  submitting,
  value,
  onChangeValue,
}: AccountConfirmDialogProps) {
  const tCommon = useTranslations("Common");
  const tAuth = useTranslations("Auth");

  return (
    <AbstractDialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
      title={title}
      titleProps={{ sx: { color: `${color}.main`, fontWeight: "bold" } }}
      onCancel={onClose}
      onConfirm={onConfirm}
      confirmText={confirmText}
      confirmColor={color}
      isSubmitting={submitting}
      confirmDisabled={!value}
      cancelText={tCommon("cancel")}
    >
      <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {prompt}
      </Typography>
      <FormTextField
        autoFocus
        fullWidth
        variant="outlined"
        type="password"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChangeValue(e.target.value)}
        placeholder={tAuth("fields.passwordOrToken")}
        disabled={submitting}
        autoComplete="off"
      />
    </AbstractDialog>
  );
}
