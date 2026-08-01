import { getDatabase } from "@/lib/db";
import { userSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import NewIdeaForm from "@/components/idea/NewIdeaForm";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Idea" });
  return { title: t("postIdeaTitle") };
}

export default async function NewIdeaPage() {
  const session = await auth();
  const db = await getDatabase();
  let defaultVisibility = "public";

  if (session?.user?.id) {
    const settingsRecord = await db
      .select({ defaultIdeaStatus: userSettings.defaultIdeaStatus })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .get();
    
    if (settingsRecord?.defaultIdeaStatus) {
      defaultVisibility = settingsRecord.defaultIdeaStatus;
    }
  }

  return <NewIdeaForm defaultVisibility={defaultVisibility} />;
}
