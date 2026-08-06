import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsApiKeys } from "@/lib/queries/settingsData";
import { getConnectedOAuthApps, getOwnedOAuthApps } from "@/lib/queries/oauthSettings";
import SettingsSection from "@/components/settings/SettingsSection";
import { DeveloperTabsLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("developer.title") };
}

export default async function DeveloperSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const userId = session!.user!.id!;

  const [apiKeys, ownedApps, connectedApps] = await Promise.all([
    getSettingsApiKeys(userId),
    getOwnedOAuthApps(userId),
    getConnectedOAuthApps(userId),
  ]);

  return (
    <SettingsSection title={t("developer.title")}>
      <DeveloperTabsLazy apiKeys={apiKeys} ownedApps={ownedApps} connectedApps={connectedApps} />
    </SettingsSection>
  );
}
