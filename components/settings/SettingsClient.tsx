"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { updateProfile, generateApiKey, deleteApiKey, disconnectGitHub, changeUsername, changeEmail, changePassword, deleteAccount } from "@/lib/actions/settings";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Divider from "@mui/material/Divider";
import { signIn, signOut } from "next-auth/react";

interface SettingsClientProps {
  user: { username: string, displayName: string, bio: string, email: string };
  apiKeys: { id: string, name: string, createdAt: Date, lastUsedAt: Date | null }[];
  isGitHubConnected: boolean;
  hasPassword?: boolean;
}

export default function SettingsClient({ user, apiKeys, isGitHubConnected, hasPassword }: SettingsClientProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
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

  // Account State
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [accMsg, setAccMsg] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const showAccMsg = (type: "success" | "error", key: string) => {
    setAccMsg({ type, text: t(`account.${key}`) });
    setTimeout(() => setAccMsg(null), 4000);
  };

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username === user.username) return;
    const res = await changeUsername(username);
    if (res.error) showAccMsg("error", res.error);
    else showAccMsg("success", "successId");
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email === user.email) return;
    const res = await changeEmail(email);
    if (res.error) showAccMsg("error", res.error);
    else showAccMsg("success", "successEmail");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      showAccMsg("error", "passwordMismatch");
      return;
    }
    const res = await changePassword(oldPass, newPass);
    if (res.error) showAccMsg("error", res.error);
    else {
      showAccMsg("success", "successPassword");
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
    }
  };

  const handleDeleteAccount = async () => {
    const res = await deleteAccount();
    if (res.success) {
      setDeleteOpen(false);
      signOut({ callbackUrl: "/" });
    }
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t("profile.title")} />
          <Tab label={t("apiKeys.title")} />
          <Tab label={t("github.title")} />
          <Tab label={t("account.title")} />
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
          <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("profile.save")}</Button>
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
            <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("apiKeys.generate")}</Button>
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
                      {k.lastUsedAt ? format.dateTime(new Date(k.lastUsedAt), { dateStyle: "short" }) : t("apiKeys.neverUsed")}
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
                      {t("apiKeys.noKeys")}
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

      {/* Account Settings */}
      {tab === 3 && (
        <Box>
          {accMsg && <Alert severity={accMsg.type} sx={{ mb: 4 }}>{accMsg.text}</Alert>}

          <Box component="form" onSubmit={handleUsernameChange} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>{t("account.changeId")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.changeIdDesc")}</Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label={t("account.newId")} size="small" value={username} onChange={e => setUsername(e.target.value)} required />
              <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("account.updateBtn")}</Button>
            </Box>
          </Box>
          
          <Divider sx={{ my: 4 }} />

          <Box component="form" onSubmit={handleEmailChange} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{t("account.changeEmail")}</Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label={t("account.newEmail")} size="small" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("account.updateBtn")}</Button>
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          {hasPassword && (
            <Box component="form" onSubmit={handlePasswordChange} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>{t("account.changePassword")}</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 300 }}>
                <TextField label={t("account.currentPassword")} type="password" size="small" value={oldPass} onChange={e => setOldPass(e.target.value)} required />
                <TextField label={t("account.newPassword")} type="password" size="small" value={newPass} onChange={e => setNewPass(e.target.value)} required />
                <TextField label={t("account.confirmPassword")} type="password" size="small" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start", height: 40 }}>{t("account.updateBtn")}</Button>
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 4 }} />

          <Box>
            <Typography variant="h6" color="error" sx={{ mb: 1 }}>{t("account.deleteAccount")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.deleteAccountDesc")}</Typography>
            <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>
              {t("account.deleteBtn")}
            </Button>
          </Box>

          <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
            <DialogTitle>{t("account.deleteAccount")}</DialogTitle>
            <DialogContent>
              <DialogContentText>{t("account.deleteAccountConfirm")}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteOpen(false)}>{tCommon("cancel")}</Button>
              <Button color="error" variant="contained" onClick={handleDeleteAccount}>
                {t("account.deleteBtn")}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
