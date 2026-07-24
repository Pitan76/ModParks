"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { createScanAppeal } from "@/lib/actions/scanAppeal";
import type { ScanFinding } from "@/workers/jar/src/types";

export type ScanStatusBannerProps = {
  versionId: string;
  scanStatus: string;
  /** JSON 文字列。作者・管理者にのみ渡す想定 */
  scanFindings?: string | null;
  /** 作者・メンバー・管理者のみ異議申請できる */
  canAppeal: boolean;
};

const parseFindings = (raw?: string | null): ScanFinding[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * バージョンのスキャン判定を表示する。
 * suspicious は警告、malicious はブロック表示。作者には異議申請導線を出す。
 */
const ScanStatusBanner = ({ versionId, scanStatus, scanFindings, canAppeal }: ScanStatusBannerProps) => {
  const t = useTranslations("Scan");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | string | null>(null);

  if (scanStatus !== "suspicious" && scanStatus !== "malicious") return null;

  const findings = canAppeal ? parseFindings(scanFindings) : [];
  const severity = scanStatus === "malicious" ? "error" : "warning";

  const submit = async () => {
    setSubmitting(true);
    const form = new FormData();
    form.set("reason", reason);
    const res = await createScanAppeal(versionId, form);
    setSubmitting(false);
    if ("success" in res) {
      setResult("success");
      setOpen(false);
    } else {
      setResult(res.error);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Alert
        severity={severity}
        action={
          canAppeal && result !== "success" ? (
            <Button color="inherit" size="small" onClick={() => setOpen(true)}>
              {t("appeal")}
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>{t(`status.${scanStatus}.title`)}</AlertTitle>
        {t(`status.${scanStatus}.body`)}

        {findings.length > 0 && (
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {findings.map((f, i) => (
              <li key={i}>
                <Typography variant="caption">
                  {f.rule} — {f.target}
                </Typography>
              </li>
            ))}
          </Box>
        )}

        {result === "success" && (
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            {t("appealSubmitted")}
          </Typography>
        )}
      </Alert>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("appealDialogTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("appealDialogDesc")}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("appealReasonPlaceholder")}
          />
          {result && result !== "success" && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
              {t(`errors.${result}`)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button variant="contained" disabled={submitting || !reason.trim()} onClick={submit}>
            {t("submitAppeal")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScanStatusBanner;
