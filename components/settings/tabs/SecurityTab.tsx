"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { generateTotpSecret, verifyAndEnableTotp, disableTotp } from "@/lib/actions/settingsSecurity";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormTextField from "@/components/ui/form/FormTextField";
import AbstractDialog from "@/components/ui/AbstractDialog";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import DialogContentText from "@mui/material/DialogContentText";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";
import PasskeyManager from "@/components/settings/passkey/PasskeyManager";
import type { PasskeyInfo } from "@/lib/actions/passkey";

interface SecurityTabProps {
  is2FAEnabled: boolean;
  setIs2FAEnabled: (enabled: boolean) => void;
  passkeys: PasskeyInfo[];
}

export default function SecurityTab({ is2FAEnabled, setIs2FAEnabled, passkeys }: SecurityTabProps) {
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
            <AbstractDialog 
              open={disableTotpOpen} 
              onClose={() => setDisableTotpOpen(false)}
              title={t("security.disableTwoFactor")}
              onCancel={() => setDisableTotpOpen(false)}
              onConfirm={handleDisableTotp}
              confirmText={t("security.disableTwoFactor")}
              confirmColor="error"
              cancelText={tCommon("cancel")}
            >
              <DialogContentText sx={{ mb: 2 }}>{t("account.currentPassword")}</DialogContentText>
              <FormTextField fullWidth type="password" size="small" value={disableTotpPasswordOrToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisableTotpPasswordOrToken(e.target.value)} />
            </AbstractDialog>
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
              <FormTextField label={t("security.verificationCode")} size="small" value={totpToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotpToken(e.target.value)} />
              <Button variant="contained" onClick={handleVerifyTotp} disabled={!totpToken}>{t("security.verifyAndEnable")}</Button>
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 4 }} />

      <PasskeyManager initialPasskeys={passkeys} />
    </Box>
  );
}
