"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { startChreeIdClaim } from "@/lib/actions/chreeId";

/**
 * ChreeID の引き取り欄。
 *
 * ModParks のアカウントはそのまま残る。引き取ると、同じアカウントに
 * ChreeID でもログインできるようになる、という位置付けで見せる。
 */
export default function ChreeIdSection({ isConnected }: { isConnected: boolean }) {
  const t = useTranslations("Settings.chreeid");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleClaim = async () => {
    setBusy(true);
    const res = await startChreeIdClaim().finally(() => setBusy(false));
    if (!res.success) return setMessage({ type: "error", text: t("claimFailed") });
    if ("alreadyClaimed" in res) return setMessage({ type: "success", text: t("alreadyClaimed") });
    window.location.href = res.claimUrl;
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{t("title")}</Typography>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("desc")}</Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        {t("status")}: <strong>{isConnected ? t("connected") : t("disconnected")}</strong>
      </Typography>
      <Button variant="contained" onClick={handleClaim} disabled={busy}>{t("claim")}</Button>
    </Box>
  );
}
