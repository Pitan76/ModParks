"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { updateIntegrations, disconnectGitHub, disconnectGoogle, toggleGithubVisibility } from "@/lib/actions/settings";
import CurseForgeVerify from "./CurseForgeVerify";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface IntegrationTabProps {
  modrinthApiKey: string;
  curseforgeProjectId: string;
  curseforgeVerified: boolean;
  curseforgeVerifyCode: string;
  isGitHubConnected: boolean;
  isGoogleConnected: boolean;
  showGithubLinkInitial: boolean;
}

export default function IntegrationTab({ modrinthApiKey, curseforgeProjectId, curseforgeVerified, curseforgeVerifyCode, isGitHubConnected, isGoogleConnected, showGithubLinkInitial }: IntegrationTabProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { message, flash } = useFlashMessage();

  const [modrinthKey, setModrinthKey] = useState(modrinthApiKey || "");

  const [githubMsg, setGithubMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [googleMsg, setGoogleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showGithubLink, setShowGithubLink] = useState(showGithubLinkInitial);

  /** 連携解除アクションのエラーコードを表示用メッセージに変換する */
  function describeDisconnectError(code: string) {
    if (code === "LAST_LOGIN_METHOD") return t("oauth.errorLastLoginMethod");
    return t("oauth.errorDisconnect");
  }

  const handleIntegrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateIntegrations(modrinthKey);
    flash("success", tCommon("saved") || "保存しました");
  };

  const handleDisconnect = async () => {
    const res = await disconnectGitHub();
    setGithubMsg(res.error
      ? { type: "error", text: describeDisconnectError(res.error) }
      : { type: "success", text: t("github.successDisconnect") });
    setTimeout(() => setGithubMsg(null), 5000);
  };

  const handleDisconnectGoogle = async () => {
    const res = await disconnectGoogle();
    setGoogleMsg(res.error
      ? { type: "error", text: describeDisconnectError(res.error) }
      : { type: "success", text: t("google.successDisconnect") });
    setTimeout(() => setGoogleMsg(null), 5000);
  };

  const handleToggleGithubVisibility = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setShowGithubLink(val);
    await toggleGithubVisibility(val);
    setGithubMsg({ type: "success", text: val ? t("github.successShow") : t("github.successHide") });
    setTimeout(() => setGithubMsg(null), 3000);
  };

  return (
    <Box>
      <Box component="form" onSubmit={handleIntegrationSubmit} sx={{ p: "2px" }}>
        {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

        <Typography variant="h6" sx={{ mb: 1 }}>{t("integration.modrinth")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t("integration.modrinthDesc")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          APIキー（PAT）は <a href="https://modrinth.com/settings/pats" target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>Modrinth Settings</a> から作成できます。「Read projects」と「Read user data」の権限が必要です。
        </Typography>
        <TextField fullWidth label="Modrinth API Key" size="small" type="password" value={modrinthKey} onChange={(e) => setModrinthKey(e.target.value)} sx={{ mb: 3, maxWidth: 400 }} />

        <Button type="submit" variant="contained" sx={{ display: "block", mb: 4 }}>{t("profile.save")}</Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>{t("integration.curseforge")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("integration.curseforgeDesc")}</Typography>
      <CurseForgeVerify projectId={curseforgeProjectId} verified={curseforgeVerified} pendingCode={curseforgeVerifyCode} />

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>{t("github.title")}</Typography>
      {githubMsg && <Alert severity={githubMsg.type} sx={{ mb: 3 }}>{githubMsg.text}</Alert>}
      <Typography variant="body1" sx={{ mb: 3 }}>
        {t("github.status")}: <strong>{isGitHubConnected ? t("github.connected") : t("github.disconnected")}</strong>
      </Typography>
      {isGitHubConnected ? (
        <Box>
          <Button variant="outlined" color="error" onClick={handleDisconnect} sx={{ mb: 3, display: "block" }}>{t("github.disconnect")}</Button>
          <FormControlLabel control={<Switch checked={showGithubLink} onChange={handleToggleGithubVisibility} />} label={t("github.showLink")} />
        </Box>
      ) : (
        <Button variant="contained" onClick={() => signIn("github")}>{t("github.connect")}</Button>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>{t("google.title")}</Typography>
      {googleMsg && <Alert severity={googleMsg.type} sx={{ mb: 3 }}>{googleMsg.text}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("google.desc")}</Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        {t("google.status")}: <strong>{isGoogleConnected ? t("google.connected") : t("google.disconnected")}</strong>
      </Typography>
      {isGoogleConnected ? (
        <Button variant="outlined" color="error" onClick={handleDisconnectGoogle}>{t("google.disconnect")}</Button>
      ) : (
        <Button variant="contained" onClick={() => signIn("google")}>{t("google.connect")}</Button>
      )}
    </Box>
  );
}
