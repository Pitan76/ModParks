"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { startCfVerification, confirmCfVerification } from "@/lib/actions/cf-verify";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

interface CurseForgeVerifyProps {
  projectId: string;
  verified: boolean;
  pendingCode: string;
}

/** CurseForge プロジェクトの所有をチャレンジコードで確認するUI */
export default function CurseForgeVerify({ projectId, verified, pendingCode }: CurseForgeVerifyProps) {
  const t = useTranslations("Settings.cfVerify");
  const [pid, setPid] = useState(projectId || "");
  const [code, setCode] = useState(pendingCode || "");
  const [isVerified, setIsVerified] = useState(verified);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleStart = async () => {
    const res = await startCfVerification(pid);
    if (!res.ok) return setMsg({ type: "error", text: t(`error.${res.error}`) });
    setCode(res.code);
    setIsVerified(false);
    setMsg(null);
  };

  const handleConfirm = async () => {
    const res = await confirmCfVerification();
    if (!res.ok) return setMsg({ type: "error", text: t(`error.${res.error}`) });
    setIsVerified(true);
    setCode("");
    setMsg({ type: "success", text: t("verifiedNow") });
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("desc")}</Typography>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
      {isVerified && !msg && <Alert severity="success" sx={{ mb: 2 }}>{t("verified")}</Alert>}

      <TextField
        fullWidth
        label={t("projectIdLabel")}
        size="small"
        value={pid}
        onChange={(e) => setPid(e.target.value)}
        helperText={t("projectIdHelp")}
        sx={{ mb: 2, maxWidth: 400 }}
      />
      <Button variant="outlined" onClick={handleStart} sx={{ display: "block", mb: 3 }}>{t("generate")}</Button>

      {code && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>{t("codeInstruction")}</Typography>
          <TextField fullWidth size="small" value={code} slotProps={{ input: { readOnly: true } }} sx={{ mb: 2, maxWidth: 400 }} />
          <Button variant="contained" onClick={handleConfirm} sx={{ display: "block" }}>{t("confirm")}</Button>
        </Box>
      )}
    </Box>
  );
}
