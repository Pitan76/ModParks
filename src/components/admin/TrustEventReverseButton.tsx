"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { reverseTrustEventAction } from "@/lib/actions/adminTrust";

export type TrustEventReverseButtonProps = {
  userId: string;
  eventId: string;
};

/**
 * 台帳の行から直接却下する。
 * 「どのイベントを消すか」を考えさせず、見えている行をそのまま無効化できるようにする。
 */
export default function TrustEventReverseButton({ userId, eventId }: TrustEventReverseButtonProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      await reverseTrustEventAction(userId, eventId, reason);
      setOpen(false);
      setReason("");
    });
  };

  return (
    <>
      <Button size="small" color="warning" onClick={() => setOpen(true)}>
        {t("trust.actions.reverse.action")}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("trust.actions.reverse.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{t("trust.actions.reverse.hint")}</DialogContentText>
          <TextField
            autoFocus fullWidth size="small"
            label={t("trust.actions.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{tCommon("cancel")}</Button>
          <Button variant="contained" color="warning" disabled={pending || !reason.trim()} onClick={submit}>
            {t("trust.actions.reverse.submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
