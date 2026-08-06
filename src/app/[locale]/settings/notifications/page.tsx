import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsPreferences } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { NotificationsTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("notifications.title") };
}

export default async function NotificationsSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const prefs = await getSettingsPreferences(session!.user!.id!);

  return (
    <SettingsSection title={t("notifications.title")}>
      <NotificationsTabLazy initialPrefs={prefs.notificationPrefs} initialWebhookUrl={prefs.discordWebhookUrl} />
    </SettingsSection>
  );
}
