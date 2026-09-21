"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { revealSecret } from "@/lib/actions/revealSecret";

/**
 * 【一時的】値を失った Web Push の鍵を一度だけ表示する。
 * 回収後は revealSecret.ts の SECRET_REVEAL_ENABLED を false にして無効化する。
 */
const NAMES = ["VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

export default function SecretRevealPanel() {
  const t = useTranslations("Admin.config");
  const [name, setName] = useState<string>(NAMES[0]);
  const [totp, setTotp] = useState("");
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReveal = () => {
    setError(null);
    setValue(null);
    startTransition(async () => {
      const result = await revealSecret(name, totp);
      setTotp("");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setValue(result.value);
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("revealSecret")}</Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>{t("revealSecretDesc")}</Alert>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField select label={t("secretName")} value={name} onChange={(e) => setName(e.target.value)} size="small">
            {NAMES.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
          <TextField
            label={t("totpCode")}
            helperText={t("totpHelp")}
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            size="small"
            autoComplete="one-time-code"
          />
          <Box>
            <Button variant="contained" color="warning" onClick={handleReveal} disabled={isPending || !totp}>
              {t("revealButton")}
            </Button>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {value && (
            <TextField
              label={t("revealedValue")}
              value={value}
              size="small"
              multiline
              slotProps={{ input: { readOnly: true } }}
              onFocus={(e) => e.target.select()}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
