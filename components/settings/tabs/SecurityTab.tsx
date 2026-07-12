"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { generateTotpSecret, verifyAndEnableTotp, disableTotp } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface SecurityTabProps {
  is2FAEnabled: boolean;
  setIs2FAEnabled: (enabled: boolean) => void;
}

export default function SecurityTab({ is2FAEnabled, setIs2FAEnabled }: SecurityTabProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { message, flash, setMessage } = useFlashMessage();

  const [totpSetupUri, setTotpSetupUri] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [disableTotpOpen, setDisableTotpOpen] = useState(false);
  const [disableTotpPasswordOrToken, setDisableTotpPasswordOrToken] = useState("");

  const handleSetupTotp = async () => {
    const res = await generateTotpSecret();
    setTotpSetupUri(res.uri);
    setMessage(null);
    setTotpToken("");
  };

  const handleVerifyTotp = async () => {
    setMessage(null);
    if (!totpToken) return;
    const res = await verifyAndEnableTotp(totpToken);
    if (res.error) {
      flash("error", t("security.invalidCode"));
    } else {
      setIs2FAEnabled(true);
      setTotpSetupUri("");
      setTotpToken("");
      flash("success", t("profile.success"));
    }
  };

  const handleDisableTotp = async () => {
    const res = await disableTotp(disableTotpPasswordOrToken);
    if (res.error) {
      flash("error", t("security.invalidCode"));
      return;
    }
    setDisableTotpOpen(false);
    setIs2FAEnabled(false);
    setDisableTotpPasswordOrToken("");
    flash("success", t("profile.success"));
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t("security.twoFactorDesc")}</Typography>

      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("security.twoFactorAuth")}</Typography>
        <Typography variant="body2" sx={{ mb: 3 }} color={is2FAEnabled ? "success.main" : "text.secondary"}>
          {is2FAEnabled ? t("security.twoFactorEnabled") : t("security.twoFactorDisabled")}
        </Typography>

        {is2FAEnabled ? (
          <>
            <Button variant="outlined" color="error" onClick={() => setDisableTotpOpen(true)}>{t("security.disableTwoFactor")}</Button>
            <Dialog open={disableTotpOpen} onClose={() => setDisableTotpOpen(false)}>
              <DialogTitle>{t("security.disableTwoFactor")}</DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>{t("account.currentPassword")}</DialogContentText>
                <TextField fullWidth type="password" size="small" value={disableTotpPasswordOrToken} onChange={(e) => setDisableTotpPasswordOrToken(e.target.value)} />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDisableTotpOpen(false)}>{tCommon("cancel")}</Button>
                <Button color="error" variant="contained" onClick={handleDisableTotp}>{t("security.disableTwoFactor")}</Button>
              </DialogActions>
            </Dialog>
          </>
        ) : !totpSetupUri ? (
          <Button variant="contained" onClick={handleSetupTotp}>{t("security.enableTwoFactor")}</Button>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t("security.twoFactorSetupTitle")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("security.twoFactorSetupDesc")}</Typography>
            <Box sx={{ bgcolor: "white", p: 2, display: "inline-block", borderRadius: 1, mb: 3 }}>
              <QRCodeSVG value={totpSetupUri} size={200} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label={t("security.verificationCode")} size="small" value={totpToken} onChange={(e) => setTotpToken(e.target.value)} />
              <Button variant="contained" onClick={handleVerifyTotp} disabled={!totpToken}>{t("security.verifyAndEnable")}</Button>
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("security.passkeys")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t("security.passkeysDesc")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>{t("security.noPasskeys")}</Typography>
        <Button variant="outlined" disabled>{t("security.registerPasskey")}</Button>
      </Box>
    </Box>
  );
}
