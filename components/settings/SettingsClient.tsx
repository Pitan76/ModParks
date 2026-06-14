"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile, generateApiKey, deleteApiKey, disconnectGitHub } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { signIn } from "next-auth/react";

interface SettingsClientProps {
  user: { displayName: string, bio: string };
  apiKeys: { id: string, name: string, createdAt: Date, lastUsedAt: Date | null }[];
  isGitHubConnected: boolean;
}

export default function SettingsClient({ user, apiKeys, isGitHubConnected }: SettingsClientProps) {
  const t = useTranslations("Settings");
  const [tab, setTab] = useState(0);

  // Profile State
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [profileMsg, setProfileMsg] = useState("");

  // API Key State
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  // GitHub State
  const [githubMsg, setGithubMsg] = useState("");

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ displayName, bio });
    setProfileMsg(t("profile.success"));
    setTimeout(() => setProfileMsg(""), 3000);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    const res = await generateApiKey(newKeyName);
    if (res.success && res.key) {
      setGeneratedKey(res.key);
      setNewKeyName("");
      setApiKeyMsg(t("apiKeys.successGenerate"));
    }
  };

  const handleDeleteKey = async (id: string) => {
    await deleteApiKey(id);
    setApiKeyMsg(t("apiKeys.successDelete"));
    setGeneratedKey("");
    setTimeout(() => setApiKeyMsg(""), 3000);
  };

  const handleDisconnect = async () => {
    await disconnectGitHub();
    setGithubMsg(t("github.successDisconnect"));
    setTimeout(() => setGithubMsg(""), 3000);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t("profile.title")} />
          <Tab label={t("apiKeys.title")} />
          <Tab label={t("github.title")} />
        </Tabs>
      </Box>

      {/* Profile Settings */}
      {tab === 0 && (
        <Box component="form" onSubmit={handleProfileSubmit}>
          {profileMsg && <Alert severity="success" sx={{ mb: 3 }}>{profileMsg}</Alert>}
          <TextField
            label={t("profile.displayName")}
            fullWidth
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            sx={{ mb: 3 }}
          />
          <TextField
            label={t("profile.bio")}
            fullWidth
            multiline
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            sx={{ mb: 4 }}
          />
          <Button type="submit" variant="contained" size="large">{t("profile.save")}</Button>
        </Box>
      )}

      {/* API Keys Settings */}
      {tab === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("apiKeys.description")}
          </Typography>

          {apiKeyMsg && <Alert severity="success" sx={{ mb: 3 }}>{apiKeyMsg}</Alert>}

          {generatedKey && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: "monospace", fontWeight: "bold" }}>{generatedKey}</Typography>
                <IconButton size="small" onClick={() => navigator.clipboard.writeText(generatedKey)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Alert>
          )}

          <Box component="form" onSubmit={handleGenerateKey} sx={{ display: "flex", gap: 2, mb: 4 }}>
            <TextField
              label={t("apiKeys.name")}
              size="small"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
            />
            <Button type="submit" variant="contained">{t("apiKeys.generate")}</Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("apiKeys.name")}</TableCell>
                  <TableCell>{t("apiKeys.lastUsed")}</TableCell>
                  <TableCell align="right">{t("apiKeys.delete")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell>
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : t("apiKeys.neverUsed")}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton color="error" onClick={() => handleDeleteKey(k.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {apiKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      No API keys found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* GitHub Integration */}
      {tab === 2 && (
        <Box>
          {githubMsg && <Alert severity="success" sx={{ mb: 3 }}>{githubMsg}</Alert>}
          <Typography variant="body1" sx={{ mb: 3 }}>
            Status: <strong>{isGitHubConnected ? t("github.connected") : t("github.disconnected")}</strong>
          </Typography>
          {isGitHubConnected ? (
            <Button variant="outlined" color="error" onClick={handleDisconnect}>
              {t("github.disconnect")}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => signIn("github")}>
              {t("github.connect")}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
