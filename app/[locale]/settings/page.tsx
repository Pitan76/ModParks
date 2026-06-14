import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { users, apiKeys, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "@/components/settings/SettingsClient";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Settings");

  const d1 = await getD1();
  const db = getDb(d1);

  const userRecord = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  const userApiKeys = await db.select().from(apiKeys).where(eq(apiKeys.userId, session.user.id));
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, session.user.id));

  const isGitHubConnected = userAccounts.some(acc => acc.provider === "github");

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 800 }}>
        {t("title")}
      </Typography>
      <SettingsClient
        user={{ displayName: userRecord?.displayName || "", bio: userRecord?.bio || "" }}
        apiKeys={userApiKeys}
        isGitHubConnected={isGitHubConnected}
      />
    </Container>
  );
}
