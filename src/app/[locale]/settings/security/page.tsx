import { getTranslations } from "next-intl/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSettingsCredentials } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { SecuritySectionLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("security.title") };
}

export default async function SecuritySettingsPage() {
  const db = await getDatabase();
  const session = await auth();
  const t = await getTranslations("Settings");
  const credentials = await getSettingsCredentials(db, session!.user!.id!);

  return (
    <SettingsSection title={t("security.title")}>
      <SecuritySectionLazy
        twoFactorEnabled={credentials.twoFactorEnabled}
        passkeys={credentials.passkeys}
      />
    </SettingsSection>
  );
}
