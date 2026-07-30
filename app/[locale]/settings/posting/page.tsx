import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsPreferences } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { PostingTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("posting.title") };
}

export default async function PostingSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const prefs = await getSettingsPreferences(session!.user!.id!);

  return (
    <SettingsSection title={t("posting.title")}>
      <PostingTabLazy
        defaultProjectStatus={prefs.defaultProjectStatus}
        defaultLicense={prefs.defaultLicense}
      />
    </SettingsSection>
  );
}
