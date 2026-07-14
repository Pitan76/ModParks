"use client";

import { useState, useEffect } from "react";
import AbstractDialog from "@/components/ui/AbstractDialog";
import DialogContentText from "@mui/material/DialogContentText";
import FormTextField from "@/components/ui/form/FormTextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useTranslations } from "next-intl";

export interface TypedConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  expectedValue: string;
  expectedValueLabel?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  pending?: boolean;
}

export default function TypedConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  expectedValue,
  expectedValueLabel,
  confirmButtonText,
  cancelButtonText,
  pending = false,
}: TypedConfirmDialogProps) {
  const tCommon = useTranslations("Common");
  const actualLabel = expectedValueLabel || tCommon("confirmLabel");
  const actualConfirm = confirmButtonText || tCommon("delete");
  const actualCancel = cancelButtonText || tCommon("cancel");

  const [inputValue, setInputValue] = useState("");

  // ダイアログが開くたびに入力値をリセット
  useEffect(() => {
    if (open) {
      setInputValue("");
    }
  }, [open]);

  const isMatch = inputValue === expectedValue;

  return (
    <AbstractDialog 
      open={open} 
      onClose={() => !pending && onClose()} 
      maxWidth="sm" 
      fullWidth
      title={title}
      titleProps={{ sx: { color: "error.main", fontWeight: "bold" } }}
      onCancel={onClose}
      onConfirm={onConfirm}
      confirmText={actualConfirm}
      cancelText={actualCancel}
      confirmColor="error"
      isSubmitting={pending}
      confirmDisabled={!isMatch}
    >
      <DialogContentText sx={{ mb: 3 }}>
        {description}
      </DialogContentText>
      
      <Box sx={{ bgcolor: "background.default", p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider", mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {actualLabel}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: "bold", userSelect: "all", fontFamily: "monospace" }}>
          {expectedValue}
        </Typography>
      </Box>

      <FormTextField
        autoFocus
        fullWidth
        variant="outlined"
        value={inputValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
        placeholder={expectedValue}
        disabled={pending}
        error={inputValue.length > 0 && !isMatch}
        autoComplete="off"
      />
    </AbstractDialog>
  );
}
