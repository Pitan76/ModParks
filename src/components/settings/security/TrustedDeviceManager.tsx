"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";
import {
  listTrustedDevices,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
  type TrustedDeviceSummary,
} from "@/lib/actions/trustedDevices";

/** User-Agent は長すぎて一覧で読めないため、ブラウザ名の手掛かりだけを残す */
const shortenUserAgent = (userAgent: string | null): string | null => {
  if (!userAgent) return null;
  return userAgent.length > 60 ? `${userAgent.slice(0, 60)}…` : userAgent;
};

/**
 * 2FA を省略できるブラウザ（信頼済みデバイス）の管理。
 * 登録はログイン時のみで、ここでは確認と取り消しを行う。
 */
export default function TrustedDeviceManager() {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();
  const [devices, setDevices] = useState<TrustedDeviceSummary[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    listTrustedDevices().then(setDevices).catch(() => flash("error", t("security.trustedDevicesLoadError")));
  }, [flash, t]);

  const handleRevoke = async (id: string) => {
    setPending(true);
    await revokeTrustedDevice(id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setPending(false);
    flash("success", t("security.trustedDeviceRevoked"));
  };

  const handleRevokeAll = async () => {
    setPending(true);
    await revokeAllTrustedDevices();
    setDevices([]);
    setPending(false);
    flash("success", t("security.trustedDeviceRevoked"));
  };

  return (
    <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{t("security.trustedDevices")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("security.trustedDevicesDesc")}</Typography>

      {message && (
        <Typography variant="body2" color={message.type === "error" ? "error.main" : "success.main"} sx={{ mb: 2 }}>
          {message.text}
        </Typography>
      )}

      {devices.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {t("security.noTrustedDevices")}
        </Typography>
      ) : (
        <>
          <List dense sx={{ mb: 2 }}>
            {devices.map((device) => (
              <ListItem
                key={device.id}
                secondaryAction={
                  <IconButton edge="end" color="error" disabled={pending} onClick={() => handleRevoke(device.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {shortenUserAgent(device.userAgent) ?? t("security.trustedDeviceUnknown")}
                      {device.current && <Chip size="small" label={t("security.trustedDeviceCurrent")} />}
                    </Box>
                  }
                  secondary={t("security.trustedDeviceExpires", { date: new Date(device.expiresAt).toLocaleDateString() })}
                />
              </ListItem>
            ))}
          </List>

          <Button variant="outlined" color="error" disabled={pending} onClick={handleRevokeAll}>
            {t("security.revokeAllTrustedDevices")}
          </Button>
        </>
      )}
    </Box>
  );
}
