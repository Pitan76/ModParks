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
  if (!session?.user?.id) redirect("/api/auth/signin");

  const d1 = await getD1();
  const db = getDb(d1);
  const user = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user) redirect("/api/auth/signin");

  const linkedAccounts = await db.select().from(accounts).where(eq(accounts.userId, session.user.id)).all();
  const hasGitHub = linkedAccounts.some((a) => a.provider === "github");

  const t = await getTranslations("Profile");

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
        {t("title")}
      </Typography>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {/* アバター表示 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <Avatar
              src={user.avatarUrl ?? user.image ?? undefined}
              alt={user.displayName ?? ""}
              sx={{ width: 64, height: 64 }}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                @{user.username}
              </Typography>
              <Typography variant="body2" color={hasGitHub ? "text.secondary" : "text.disabled"}>
                {hasGitHub ? "GitHub アカウントで連携済" : "GitHub 未連携"}
              </Typography>
            </Box>
          </Box>

          {/* プロフィール編集フォーム */}
          <ProfileForm
            initialData={{
              displayName: user.displayName ?? "",
              bio: user.bio ?? "",
              avatarUrl: user.avatarUrl ?? "",
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
