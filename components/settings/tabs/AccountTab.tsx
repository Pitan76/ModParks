"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { changeUsername, changeEmail, changePassword, deleteAccount } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface AccountTabProps {
  user: { username: string; email: string };
  hasPassword: boolean;
  is2FAEnabled: boolean;
  locale: "ja" | "en";
  setLocale: (locale: "ja" | "en") => void;
}

export default function AccountTab({ user, hasPassword, is2FAEnabled, locale, setLocale }: AccountTabProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { message, flash } = useFlashMessage(4000);

  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passwordTotpToken, setPasswordTotpToken] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePasswordOrToken, setDeletePasswordOrToken] = useState("");

  const showAccMsg = (type: "success" | "error", key: string) => flash(type, t(`account.${key}`));

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
    const res = await changeEmail(email, emailPassword);
    if (res.error) showAccMsg("error", res.error);
    else showAccMsg("success", "successEmail");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      showAccMsg("error", "passwordMismatch");
      return;
    }
    const res = await changePassword(oldPass, newPass, passwordTotpToken);
    if (res.error) showAccMsg("error", res.error);
    else {
      showAccMsg("success", hasPassword ? "successPassword" : "successSetPassword");
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
      setPasswordTotpToken("");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    const res = await deleteAccount(deletePasswordOrToken);
    if (res.success) {
      setDeleteOpen(false);
      signOut({ callbackUrl: "/" });
    } else {
      showAccMsg("error", res.error || "errorWrongPassword");
      setDeleteOpen(false);
    }
    setIsDeletingAccount(false);
  };

  const handleExportData = (format: string) => {
    window.open(`/api/user/export?format=${format}`, "_blank");
  };

  return (
    <Box>
      {message && <Alert severity={message.type} sx={{ mb: 4 }}>{message.text}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t("account.language")}</Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="locale-select-label">{t("account.languageLabel")}</InputLabel>
          <Select labelId="locale-select-label" value={locale} label={t("account.languageLabel")} onChange={(e) => setLocale(e.target.value as "ja" | "en")}>
            <MenuItem value="ja">🇯🇵 日本語</MenuItem>
            <MenuItem value="en">🇺🇸 English</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t("account.languageWarning")}</Typography>
      </Box>
      <Divider sx={{ my: 4 }} />

      <Box component="form" onSubmit={handleUsernameChange} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("account.changeId")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.changeIdDesc")}</Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField label={t("account.newId")} size="small" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("account.updateBtn")}</Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box component="form" onSubmit={handleEmailChange} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t("account.changeEmail")}</Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField label={t("account.newEmail")} size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {hasPassword && <TextField label={t("account.currentPassword")} type="password" size="small" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />}
          <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("account.updateBtn")}</Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box component="form" onSubmit={handlePasswordChange} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{hasPassword ? t("account.changePassword") : t("account.setPassword")}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 300 }}>
          {hasPassword && <TextField label={t("account.currentPassword")} type="password" size="small" value={oldPass} onChange={(e) => setOldPass(e.target.value)} required />}
          <TextField label={t("account.newPassword")} type="password" size="small" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
          <TextField label={t("account.confirmPassword")} type="password" size="small" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required />
          {is2FAEnabled && <TextField label={t("security.verificationCode")} type="text" size="small" value={passwordTotpToken} onChange={(e) => setPasswordTotpToken(e.target.value)} required />}
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start", height: 40 }}>{hasPassword ? t("account.updateBtn") : t("account.setBtn")}</Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("account.exportData")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.exportDataDesc")}</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <Button variant="outlined" onClick={() => handleExportData("json")}>{t("account.exportJson")}</Button>
          <Button variant="outlined" onClick={() => handleExportData("csv")}>{t("account.exportCsv")}</Button>
          <Button variant="outlined" onClick={() => handleExportData("md")}>{t("account.exportMd")}</Button>
          <Button variant="outlined" onClick={() => handleExportData("txt")}>{t("account.exportTxt")}</Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h6" color="error" sx={{ mb: 1 }}>{t("account.deleteAccount")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.deleteAccountDesc")}</Typography>
        <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>{t("account.deleteBtn")}</Button>
      </Box>

      <Dialog open={deleteOpen} onClose={() => !isDeletingAccount && setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: "error.main", fontWeight: "bold" }}>{t("account.deleteAccount")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{t("account.deleteAccountConfirm")}</DialogContentText>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            アカウントを削除するには、パスワード（または2要素認証コード）を入力してください。
          </Typography>
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            type="password"
            value={deletePasswordOrToken}
            onChange={(e) => setDeletePasswordOrToken(e.target.value)}
            placeholder="パスワードまたは認証コード"
            disabled={isDeletingAccount}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={isDeletingAccount} variant="outlined" color="inherit">{tCommon("cancel")}</Button>
          <Button onClick={handleDeleteAccount} disabled={!deletePasswordOrToken || isDeletingAccount} variant="contained" color="error">{t("account.deleteBtn")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
