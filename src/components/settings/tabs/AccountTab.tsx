"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { changeUsername, changeEmail, deleteAccount, deactivateAccount } from "@/lib/actions/settingsSecurity";
import { updateLocale } from "@/lib/actions/settings";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { LOCALE_OPTIONS } from "@/lib/i18n/localeLabels";
import { storeLocaleCookie } from "@/lib/i18n/localeCookie";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import AccountConfirmDialog from "./account/AccountConfirmDialog";
import AccountPasswordSection from "./account/AccountPasswordSection";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface AccountTabProps {
  user: { username: string; email: string };
  hasPassword: boolean;
  is2FAEnabled: boolean;
  locale: "ja" | "en";
}

export default function AccountTab({ user, hasPassword, is2FAEnabled, locale }: AccountTabProps) {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage(4000);
  const router = useRouter();
  const pathname = usePathname();
  const { update: updateSession } = useSession();

  const [emailPassword, setEmailPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePasswordOrToken, setDeletePasswordOrToken] = useState("");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [isDeactivatingAccount, setIsDeactivatingAccount] = useState(false);
  const [deactivatePasswordOrToken, setDeactivatePasswordOrToken] = useState("");
  const [exportFormat, setExportFormat] = useState("json");

  const showAccMsg = (type: "success" | "error", key: string) => flash(type, t(`account.${key}`));

  /**
   * 表示言語・ユーザーID・メールアドレスは「値を編集する」設定なので、
   * 個別の更新ボタンを持たず、変更された項目だけをまとめて保存バーから反映する。
   */
  const form = useDirtyForm(
    { locale, username: user.username, email: user.email },
    async (values) => {
      const changed: string[] = [];

      if (values.username !== form.baseline.username) {
        const res = await changeUsername(values.username);
        if (res.error) {
          showAccMsg("error", res.error);
          return false;
        }
        changed.push("successId");
      }

      if (values.email !== form.baseline.email) {
        const res = await changeEmail(values.email, emailPassword);
        if (res.error) {
          showAccMsg("error", res.error);
          return false;
        }
        setEmailPassword("");
        changed.push("successEmail");
      }

      if (values.locale !== form.baseline.locale) {
        await updateLocale(values.locale);
        // セッションの locale は JWT に 5分キャッシュされる。先に更新しておかないと
        // LocaleSyncer が古い設定言語のURLへ引き戻してしまう
        await updateSession();
        storeLocaleCookie(values.locale);
        router.replace(pathname, { locale: values.locale });
        router.refresh();
        return;
      }

      if (changed.length) showAccMsg("success", changed[changed.length - 1]);
    }
  );
  const { locale: localeValue, username, email } = form.values;
  const emailChanged = email !== form.baseline.email;

  /** 退会・一時無効化はどちらも成功したらサインアウトしてトップへ戻す */
  const runAccountClosure = async (
    action: (secret: string) => Promise<{ success?: boolean; error?: string }>,
    secret: string,
    setSubmitting: (v: boolean) => void,
    close: () => void,
  ) => {
    setSubmitting(true);
    const res = await action(secret);
    close();
    if (res.success) signOut({ callbackUrl: "/" });
    else showAccMsg("error", res.error || "errorWrongPassword");
    setSubmitting(false);
  };

  const handleExportData = () => {
    window.open(`/api/user/export?format=${exportFormat}`, "_blank");
  };

  return (
    <Box>
      {message && <Alert severity={message.type} sx={{ mb: 4 }}>{message.text}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t("account.language")}</Typography>
        <FormSelect
          size="small"
          label={t("account.languageLabel")}
          value={localeValue}
          onChange={(e) => form.setField("locale", e.target.value as "ja" | "en")}
          options={LOCALE_OPTIONS}
          formControlProps={{ sx: { minWidth: 200 } }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t("account.languageWarning")}</Typography>
      </Box>
      <Divider sx={{ my: 4 }} />

      <Box sx={{ mb: 4, p: "2px" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("account.changeId")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.changeIdDesc")}</Typography>
        <FormTextField label={t("account.newId")} size="small" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setField("username", e.target.value)} required />
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ mb: 4, p: "2px" }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t("account.changeEmail")}</Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <FormTextField label={t("account.newEmail")} size="small" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setField("email", e.target.value)} required />
          {hasPassword && emailChanged && <FormTextField label={t("account.currentPassword")} type="password" size="small" value={emailPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailPassword(e.target.value)} required />}
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <AccountPasswordSection hasPassword={hasPassword} is2FAEnabled={is2FAEnabled} onResult={showAccMsg} />

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>{t("account.exportData")}</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 4 }}>
          <FormSelect
            size="small"
            label={t("account.exportFormat")}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as string)}
            options={[
              { value: "json", label: t("account.exportJson") },
              { value: "csv", label: t("account.exportCsv") },
              { value: "md", label: t("account.exportMd") },
              { value: "txt", label: t("account.exportTxt") },
            ]}
            formControlProps={{ sx: { minWidth: 200 } }}
          />
          <Button variant="outlined" onClick={handleExportData} sx={{ height: 40 }}>{t("account.exportBtn")}</Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="warning.main" sx={{ mb: 1 }}>{t("account.deactivateAccount")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.deactivateAccountDesc")}</Typography>
        <Button variant="outlined" color="warning" onClick={() => setDeactivateOpen(true)}>{t("account.deactivateBtn")}</Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h6" color="error" sx={{ mb: 1 }}>{t("account.deleteAccount")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("account.deleteAccountDesc")}</Typography>
        <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>{t("account.deleteBtn")}</Button>
      </Box>

      <AccountConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => runAccountClosure(deleteAccount, deletePasswordOrToken, setIsDeletingAccount, () => setDeleteOpen(false))}
        title={t("account.deleteAccount")}
        description={t("account.deleteAccountConfirm")}
        prompt={t("account.deletePasswordPrompt")}
        confirmText={t("account.deleteBtn")}
        color="error"
        submitting={isDeletingAccount}
        value={deletePasswordOrToken}
        onChangeValue={setDeletePasswordOrToken}
      />

      <AccountConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => runAccountClosure(deactivateAccount, deactivatePasswordOrToken, setIsDeactivatingAccount, () => setDeactivateOpen(false))}
        title={t("account.deactivateAccount")}
        description={t("account.deactivateAccountConfirm")}
        prompt={t("account.deactivatePasswordPrompt")}
        confirmText={t("account.deactivateBtn")}
        color="warning"
        submitting={isDeactivatingAccount}
        value={deactivatePasswordOrToken}
        onChangeValue={setDeactivatePasswordOrToken}
      />

      <StickySaveBar
        open={form.dirty}
        saving={form.saving}
        onSave={form.submit}
        onDiscard={form.reset}
        disabled={emailChanged && hasPassword && !emailPassword}
      />
    </Box>
  );
}
