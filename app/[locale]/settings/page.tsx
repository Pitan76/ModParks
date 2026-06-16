import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { users, userProfiles, userSettings, apiKeys, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "@/components/settings/SettingsClient";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Settings");

  const db = await getDatabase();

  const userRecord = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  const profileRecord = await db.select().from(userProfiles).where(eq(userProfiles.userId, session.user.id)).get();
  const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  const userApiKeys = await db.select().from(apiKeys).where(eq(apiKeys.userId, session.user.id));
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, session.user.id));

  const isGitHubConnected = userAccounts.some(acc => acc.provider === "github");

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 800 }}>
        {t("title")}
      </Typography>
      <SettingsClient
        user={{
          username: profileRecord?.username || "",
          displayName: profileRecord?.displayName || "",
          bio: profileRecord?.bio || "",
          email: userRecord?.email || "",
          avatarUrl: profileRecord?.avatarUrl || "",
          links: profileRecord?.links || "[]",
          locale: settingsRecord?.locale || "ja",
          showGithubLink: (settingsRecord?.custom as Record<string, any>)?.showGithubLink ?? true,
        }}
        apiKeys={userApiKeys}
        isGitHubConnected={isGitHubConnected}
        hasPassword={!!userRecord?.passwordHash}
        twoFactorEnabled={!!userRecord?.twoFactorEnabled}
        defaultProjectStatus={settingsRecord?.defaultProjectStatus || "draft"}
        defaultLicense={settingsRecord?.defaultLicense || "All Rights Reserved"}
        error={resolvedSearchParams.error as string | undefined}
      />
    </Container>
  );
}
