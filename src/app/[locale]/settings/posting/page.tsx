import { getTranslations } from "next-intl/server";
import { getDatabase } from "@/lib/db";
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
  const db = await getDatabase();
  const session = await auth();
  const t = await getTranslations("Settings");
  const prefs = await getSettingsPreferences(db, session!.user!.id!);

  return (
    <SettingsSection title={t("posting.title")}>
      <PostingTabLazy
        defaultProjectStatus={prefs.defaultProjectStatus}
        defaultIdeaStatus={prefs.defaultIdeaStatus}
        defaultProjectBodyFormat={prefs.defaultProjectBodyFormat}
        defaultIdeaBodyFormat={prefs.defaultIdeaBodyFormat}
        defaultCommentBodyFormat={prefs.defaultCommentBodyFormat}
        defaultLicense={prefs.defaultLicense}
        defaultCommentsEnabled={prefs.defaultCommentsEnabled}
        defaultRecipesEnabled={prefs.defaultRecipesEnabled}
      />
    </SettingsSection>
  );
}
