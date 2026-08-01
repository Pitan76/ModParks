"use client";

import Alert from "@mui/material/Alert";
import AccountTab from "./tabs/AccountTab";
import type { SettingsUser } from "@/lib/queries/settingsData";

/** アカウント設定。エラー表示を挟むだけの薄いラッパー */
export default function AccountSection({
  user,
  hasPassword,
  twoFactorEnabled,
  error,
}: {
  user: SettingsUser;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  error?: string;
}) {
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
      <AccountTab
        user={user}
        hasPassword={hasPassword}
        is2FAEnabled={twoFactorEnabled}
        locale={(user.locale as "ja" | "en") || "ja"}
      />
    </>
  );
}
