"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { overrideScanStatus, type ScanOverrideStatus } from "@/lib/actions/scanAppeal";

const OVERRIDE_STATUSES: ScanOverrideStatus[] = ["clean", "suspicious", "malicious"];

type ScanOverrideDialogProps = {
  versionId: string;
  currentStatus: string;
  /** このバージョンに保留中の異議があるか。ある場合はこの操作で同時に裁定される */
  hasPendingAppeal: boolean;
};

/**
 * 管理者がスキャン判定を直接付け替えるダイアログ。
 *
 * 異議申請を待たずに誤検知を解除できるようにするためのもので、
 * 申請経由の裁定（AppealCard）と同じ結果をスキャンログ側から起こせる。
 */
export default function ScanOverrideDialog({ versionId, currentStatus, hasPendingAppeal }: ScanOverrideDialogProps) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ScanOverrideStatus>("clean");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await overrideScanStatus(versionId, status, note);
    setBusy(false);

    if ("error" in res) {
      setError(t(`scans.override.errors.${res.error}`));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        {t("scans.override.action")}
      </Button>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("scans.override.title")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("scans.override.description", { current: currentStatus })}
          </Typography>

          <TextField
            select
            fullWidth
            size="small"
            label={t("scans.columns.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value as ScanOverrideStatus)}
          >
            {OVERRIDE_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>{t(`scans.filters.${value}`)}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            sx={{ mt: 2 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("scans.override.notePlaceholder")}
          />

          {hasPendingAppeal && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1.5 }}>
              {t("scans.override.closesAppeal")}
            </Typography>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1.5 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="small" color="inherit" disabled={busy} onClick={() => setOpen(false)}>
            {t("scans.override.cancel")}
          </Button>
          <Button size="small" variant="contained" disabled={busy} onClick={submit}>
            {t("scans.override.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
