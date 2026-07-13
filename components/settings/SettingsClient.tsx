"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import TabbedPanel from "@/components/ui/TabbedPanel";
import ProfileTab from "./tabs/ProfileTab";
import AccountTab from "./tabs/AccountTab";
import SecurityTab from "./tabs/SecurityTab";
import ApiKeysTab from "./tabs/ApiKeysTab";
import PostingTab from "./tabs/PostingTab";
import IntegrationTab from "./tabs/IntegrationTab";

interface SettingsClientProps {
  user: { username: string; displayName: string; bio: string; email: string; avatarUrl: string; links: string; locale: string; showGithubLink: boolean };
  apiKeys: { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }[];
  isGitHubConnected: boolean;
  hasPassword?: boolean;
  twoFactorEnabled?: boolean;
  defaultProjectStatus?: string;
  defaultLicense?: string;
  modrinthApiKey?: string;
  curseforgeAuthorToken?: string;
  curseforgeProjectId?: string;
  error?: string;
}

export default function SettingsClient({
  user,
  apiKeys,
  isGitHubConnected,
  hasPassword,
  twoFactorEnabled,
  defaultProjectStatus,
  defaultLicense,
  modrinthApiKey,
  curseforgeAuthorToken,
  curseforgeProjectId,
  error,
}: SettingsClientProps) {
  const t = useTranslations("Settings");

  const globalError = error === "admin_password_required" ? t("errors.adminPasswordRequired") : error;

  // タブ間で共有する状態（言語はプロフィール保存に含まれ、2FA状態はアカウント/セキュリティ双方で参照される）
  const [locale, setLocale] = useState<"ja" | "en">((user.locale as "ja" | "en") || "ja");
  const [is2FAEnabled, setIs2FAEnabled] = useState(!!twoFactorEnabled);

  const tabs = [
    { label: t("profile.title"), content: <ProfileTab user={user} locale={locale} /> },
    { label: t("account.title"), content: <AccountTab user={user} hasPassword={!!hasPassword} is2FAEnabled={is2FAEnabled} locale={locale} setLocale={setLocale} /> },
    { label: t("security.title"), content: <SecurityTab is2FAEnabled={is2FAEnabled} setIs2FAEnabled={setIs2FAEnabled} /> },
    { label: t("apiKeys.title"), content: <ApiKeysTab apiKeys={apiKeys} /> },
    { label: t("posting.title"), content: <PostingTab defaultProjectStatus={defaultProjectStatus || "draft"} defaultLicense={defaultLicense || "All Rights Reserved"} /> },
    {
      label: t("integration.title"),
      content: (
        <IntegrationTab
          modrinthApiKey={modrinthApiKey || ""}
          curseforgeAuthorToken={curseforgeAuthorToken || ""}
          curseforgeProjectId={curseforgeProjectId || ""}
          isGitHubConnected={isGitHubConnected}
          showGithubLinkInitial={user.showGithubLink}
        />
      ),
    },
  ];

  return (
    <Box>
      {globalError && <Alert severity="error" sx={{ mb: 4 }}>{globalError}</Alert>}
      <TabbedPanel items={tabs} />
    </Box>
  );
}
