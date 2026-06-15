import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Avatar from "@mui/material/Avatar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getDb, getD1 } from "@/lib/db";
import { users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProfileForm from "./ProfileForm";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/${locale}/profile`);

  const d1 = await getD1();
  const db = getDb(d1);
  const user = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user) redirect("/api/auth/signin");

  const linkedAccounts = await db.select().from(accounts).where(eq(accounts.userId, session.user.id)).all();
  const hasGitHub = linkedAccounts.some((a) => a.provider === "github");

  const t = await getTranslations("Profile");

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        {t("title")}
      </Typography>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {/* プロフィール編集フォーム */}
          <ProfileForm
            initialData={{
              displayName: user.displayName ?? "",
              bio: user.bio ?? "",
              avatarUrl: user.avatarUrl ?? user.image ?? "",
              username: user.username!,
              hasGitHub,
            }}
            labels={{
              displayName: t("displayName"),
              bio: t("bio"),
            }}
          />
        </CardContent>
      </Card>
    </Container>
  );
}
