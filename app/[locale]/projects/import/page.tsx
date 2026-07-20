import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import BatchImportClient from "@/components/project/BatchImportClient";
import { redirect } from "next/navigation";

export default async function ImportProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const db = await getDatabase();
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();

  const t = await getTranslations("Project");

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 4 }}>
        {t("batchImportTitle")}
      </Typography>

      <BatchImportClient
        hasModrinthKey={!!settings?.modrinthApiKey}
        hasCurseForgeKey={!!settings?.curseforgeVerifiedAt}
        hasCurseForgeProject={!!settings?.curseforgeVerifiedAt}
      />
    </Container>
  );
}
