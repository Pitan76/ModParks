import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsUser, getSettingsPreferences } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { IntegrationTabLazy } from "@/components/settings/SectionsLazy";
import { getGithubAppInstallUrl } from "@/lib/utils/githubApp";
import { listGithubAppAccounts } from "@/lib/queries/githubApp";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("integration.title") };
}

export default async function IntegrationSettingsPage() {
  const session = await auth();
  const t = await getTranslations("Settings");

  const [user, prefs, githubAppAccounts] = await Promise.all([
    getSettingsUser(session!.user!.id!),
    getSettingsPreferences(session!.user!.id!),
    listGithubAppAccounts(session!.user!.id!),
  ]);

  return (
    <SettingsSection title={t("integration.title")}>
      <IntegrationTabLazy
        modrinthApiKey={prefs.modrinthApiKey}
        curseforgeProjectId={prefs.curseforgeProjectId}
        curseforgeVerified={prefs.curseforgeVerified}
        curseforgeVerifyCode={prefs.curseforgeVerifyCode}
        isGitHubConnected={prefs.isGitHubConnected}
        isGoogleConnected={prefs.isGoogleConnected}
        showGithubLinkInitial={user.showGithubLink}
        githubAppAccounts={githubAppAccounts}
        githubAppInstallUrl={getGithubAppInstallUrl()}
      />
    </SettingsSection>
  );
}
