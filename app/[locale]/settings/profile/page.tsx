import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsUser } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { ProfileTabLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("profile.title") };
}

export default async function ProfileSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");
  const user = await getSettingsUser(session!.user!.id!);

  return (
    <SettingsSection title={t("profile.title")}>
      <ProfileTabLazy
        user={user}
        locale={user.locale}
        showGithubLink={user.showGithubLink && !!user.githubUsername}
        githubUsername={user.githubUsername}
      />
    </SettingsSection>
  );
}
