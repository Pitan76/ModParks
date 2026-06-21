"use client";

import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

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
  expectedValueLabel = "確認のため以下を入力してください",
  confirmButtonText = "削除",
  cancelButtonText = "キャンセル",
  pending = false,
}: TypedConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  // ダイアログが開くたびに入力値をリセット
  useEffect(() => {
    if (open) {
      setInputValue("");
    }
  }, [open]);

  const isMatch = inputValue === expectedValue;

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: "error.main", fontWeight: "bold" }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>
          {description}
        </DialogContentText>
        
        <Box sx={{ bgcolor: "background.default", p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider", mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {expectedValueLabel}
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: "bold", userSelect: "all", fontFamily: "monospace" }}>
            {expectedValue}
          </Typography>
        </Box>

        <TextField
          autoFocus
          fullWidth
          variant="outlined"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={expectedValue}
          disabled={pending}
          error={inputValue.length > 0 && !isMatch}
          autoComplete="off"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={pending} variant="outlined" color="inherit">
          {cancelButtonText}
        </Button>
        <Button 
          onClick={onConfirm} 
          disabled={!isMatch || pending} 
          variant="contained" 
          color="error"
        >
          {confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
