import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getConnectedOAuthApps, getOwnedOAuthApps } from "@/lib/queries/oauthSettings";
import SettingsSection from "@/components/settings/SettingsSection";
import { OAuthAppsTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("oauthApps.title") };
}

export default async function OAuthAppsSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const userId = session!.user!.id!;

  const [ownedApps, connectedApps] = await Promise.all([
    getOwnedOAuthApps(userId),
    getConnectedOAuthApps(userId),
  ]);

  return (
    <SettingsSection title={t("oauthApps.title")}>
      <OAuthAppsTabLazy ownedApps={ownedApps} connectedApps={connectedApps} />
    </SettingsSection>
  );
}
