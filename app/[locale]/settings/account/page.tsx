import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSettingsUser, getSettingsCredentials } from "@/lib/queries/settingsData";
import SettingsSection from "@/components/settings/SettingsSection";
import { AccountSectionLazy } from "@/components/settings/SectionsLazy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("account.title") };
}

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const t = await getTranslations("Settings");
  const resolved = await searchParams;

  const [user, credentials] = await Promise.all([
    getSettingsUser(session!.user!.id!),
    getSettingsCredentials(session!.user!.id!),
  ]);

  const rawError = resolved.error as string | undefined;
  const error = rawError === "admin_password_required" ? t("errors.adminPasswordRequired") : rawError;

  return (
    <SettingsSection title={t("account.title")}>
      <AccountSectionLazy
        user={user}
        hasPassword={credentials.hasPassword}
        twoFactorEnabled={credentials.twoFactorEnabled}
        error={error}
      />
    </SettingsSection>
  );
}
