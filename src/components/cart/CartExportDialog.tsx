"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useTranslations } from "next-intl";
import { exportCart, EXPORT_FORMATS, type ExportFormat } from "./cartExport";
import type { CartItem } from "./cartStore";

export interface CartExportDialogProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
}

/** カートの内容を選択した形式で書き出すダイアログ */
export default function CartExportDialog({ open, onClose, items }: CartExportDialogProps) {
  const t = useTranslations("Cart");
  const tCommon = useTranslations("Common");
  const [format, setFormat] = useState<ExportFormat>("json");

  function handleExport() {
    exportCart(items, format);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("exportDialogTitle")}</DialogTitle>
      <DialogContent>
        <RadioGroup value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          {EXPORT_FORMATS.map((f) => (
            <FormControlLabel key={f} value={f} control={<Radio />} label={t(`format.${f}`)} />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>{tCommon("cancel")}</Button>
        <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={handleExport}>
          {t("export")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
