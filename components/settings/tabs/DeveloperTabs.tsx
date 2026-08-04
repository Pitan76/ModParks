"use client";

import { useTranslations } from "next-intl";
import TabbedPanel from "@/components/ui/TabbedPanel";
import ApiKeysTab from "./ApiKeysTab";
import OAuthAppsTab from "./OAuthAppsTab";
import type { ConnectedOAuthApp, OwnedOAuthApp } from "@/lib/queries/oauthSettings";

type DeveloperTabsProps = {
  apiKeys: { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }[];
  ownedApps: OwnedOAuthApp[];
  connectedApps: ConnectedOAuthApp[];
};

/**
 * 開発者向け設定。API キーと OAuth アプリはどちらも「外部から ModParks を使う」ための
 * 設定なので、1ページのタブにまとめる。
 */
export default function DeveloperTabs({ apiKeys, ownedApps, connectedApps }: DeveloperTabsProps) {
  const t = useTranslations("Settings");

  return (
    <TabbedPanel
      items={[
        { label: t("apiKeys.title"), content: <ApiKeysTab apiKeys={apiKeys} /> },
        { label: t("oauthApps.title"), content: <OAuthAppsTab ownedApps={ownedApps} connectedApps={connectedApps} /> },
      ]}
    />
  );
}
