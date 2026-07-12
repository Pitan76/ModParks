"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { updateIntegrations, disconnectGitHub, toggleGithubVisibility } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useFlashMessage } from "../useFlashMessage";

interface IntegrationTabProps {
  modrinthApiKey: string;
  curseforgeApiKey: string;
  curseforgeProjectId: string;
  isGitHubConnected: boolean;
  showGithubLinkInitial: boolean;
}

export default function IntegrationTab({ modrinthApiKey, curseforgeApiKey, curseforgeProjectId, isGitHubConnected, showGithubLinkInitial }: IntegrationTabProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { message, flash } = useFlashMessage();

  const [modrinthKey, setModrinthKey] = useState(modrinthApiKey || "");
  const [curseforgeKey, setCurseforgeKey] = useState(curseforgeApiKey || "");
  const [curseforgeProject, setCurseforgeProject] = useState(curseforgeProjectId || "");

  const [githubMsg, setGithubMsg] = useState("");
  const [showGithubLink, setShowGithubLink] = useState(showGithubLinkInitial);

  const handleIntegrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateIntegrations(modrinthKey, curseforgeKey, curseforgeProject);
    flash("success", tCommon("saved") || "保存しました");
  };

  const handleDisconnect = async () => {
    await disconnectGitHub();
    setGithubMsg(t("github.successDisconnect"));
    setTimeout(() => setGithubMsg(""), 3000);
  };

  const handleToggleGithubVisibility = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setShowGithubLink(val);
    await toggleGithubVisibility(val);
    setGithubMsg(val ? t("github.successShow") : t("github.successHide"));
    setTimeout(() => setGithubMsg(""), 3000);
  };

  return (
    <Box>
      <Box component="form" onSubmit={handleIntegrationSubmit}>
        {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

        <Typography variant="h6" sx={{ mb: 1 }}>{t("integration.modrinth")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t("integration.modrinthDesc")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          APIキー（PAT）は <a href="https://modrinth.com/settings/pats" target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>Modrinth Settings</a> から作成できます。「Read projects」と「Read user data」の権限が必要です。
        </Typography>
        <TextField fullWidth label="Modrinth API Key" size="small" type="password" value={modrinthKey} onChange={(e) => setModrinthKey(e.target.value)} sx={{ mb: 4, maxWidth: 400 }} />

        <Typography variant="h6" sx={{ mb: 1 }}>{t("integration.curseforge")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t("integration.curseforgeDesc")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          APIキーは <a href="https://console.curseforge.com/?#/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>CurseForge Console</a> から作成できます。
        </Typography>
        <TextField fullWidth label="CurseForge API Key" size="small" type="password" value={curseforgeKey} onChange={(e) => setCurseforgeKey(e.target.value)} sx={{ mb: 2, maxWidth: 400 }} />
        <TextField
          fullWidth
          label="CurseForge Project ID"
          size="small"
          type="text"
          value={curseforgeProject}
          onChange={(e) => setCurseforgeProject(e.target.value)}
          helperText="CurseForgeからの一括インポートに使用します（ご自身のModのIDを1つだけ入力してください）"
          sx={{ mb: 4, maxWidth: 400 }}
        />

        <Button type="submit" variant="contained" sx={{ display: "block", mb: 4 }}>{t("profile.save")}</Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>{t("github.title")}</Typography>
      {githubMsg && <Alert severity="success" sx={{ mb: 3 }}>{githubMsg}</Alert>}
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
    </Box>
  );
}
