import { getTranslations } from "next-intl/server";
import SettingsSection from "@/components/settings/SettingsSection";
import { ThemeTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("theme.title") };
}

export default async function ThemeSettingsPage() {
  const t = await getTranslations("Settings");

  return (
    <SettingsSection title={t("theme.title")}>
      <ThemeTabLazy />
    </SettingsSection>
  );
}
