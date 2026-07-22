"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FlagIcon from "@mui/icons-material/Flag";
import { useTranslations } from "next-intl";
import { createReport } from "@/lib/actions/report";
import { REPORT_REASONS } from "@/lib/validations";

export type ReportDialogProps = {
  projectId: string;
};

/**
 * プロジェクトの問題（コンテンツ違反、バグなど）を通報するダイアログコンポーネント。
 */
const ReportDialog = ({ projectId }: ReportDialogProps) => {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    setPending(true);
    const fd = new FormData();
    fd.append("reason", reason);
    fd.append("detail", detail);
    const result = await createReport(projectId, fd);
    setPending(false);
    if (result.success) setSuccess(true);
  };

  return (
    <>
      <Button
        id="report-btn"
        onClick={() => {
          setOpen(true);
          setSuccess(false);
        }}
        startIcon={<FlagIcon />}
        size="small"
        color="error"
        variant="text"
        fullWidth
      >
        {t("title")}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        id="report-dialog"
      >
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogContent>
          {success ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              {t("success")}
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("description")}
              </Typography>
              <RadioGroup
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REPORT_REASONS.map((r) => (
                  <FormControlLabel
                    key={r}
                    value={r}
                    control={<Radio size="small" />}
                    label={t(`reasons.${r}`)}
                  />
                ))}
              </RadioGroup>
              <TextField
                id="report-detail"
                label={t("detail")}
                multiline
                rows={3}
                fullWidth
                value={detail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDetail(e.target.value)}
                sx={{ mt: 2 }}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button id="report-cancel" onClick={() => setOpen(false)} variant="text">
            {tCommon("cancel")}
          </Button>
          {!success && (
            <Button
              id="report-submit"
              onClick={handleSubmit}
              variant="text"
              color="error"
              disabled={pending}
            >
              {pending ? t("sending") : tCommon("submit")}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ReportDialog;
