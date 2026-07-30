"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import AccountTab from "./tabs/AccountTab";
import type { SettingsUser } from "@/lib/queries/settingsData";

/**
 * アカウント設定。
 * 表示言語と 2 段階認証の状態は保存前に画面へ反映する必要があるため、ここで保持する。
 */
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
  const [locale, setLocale] = useState<"ja" | "en">((user.locale as "ja" | "en") || "ja");
  const [is2FAEnabled] = useState(twoFactorEnabled);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
      <AccountTab
        user={user}
        hasPassword={hasPassword}
        is2FAEnabled={is2FAEnabled}
        locale={locale}
        setLocale={setLocale}
      />
    </>
  );
}
