import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsApiKeys } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { ApiKeysTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("apiKeys.title") };
}

export default async function ApiKeysSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const keys = await getSettingsApiKeys(session!.user!.id!);

  return (
    <SettingsSection title={t("apiKeys.title")}>
      <ApiKeysTabLazy apiKeys={keys} />
    </SettingsSection>
  );
}
