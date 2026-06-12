import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

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
              src={session.user.image ?? undefined}
              alt={session.user.name ?? ""}
              sx={{ width: 64, height: 64 }}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                @{(session.user as { username?: string }).username ?? session.user.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                GitHub アカウントで連携済
              </Typography>
            </Box>
          </Box>

          {/* プロフィール編集フォーム */}
          <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              id="profile-display-name"
              label={t("displayName")}
              defaultValue={session.user.name ?? ""}
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 64 } }}
            />
            <TextField
              id="profile-bio"
              label={t("bio")}
              multiline
              rows={3}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText="500文字以内"
            />
            <Button
              id="profile-save-btn"
              type="submit"
              variant="contained"
              size="large"
            >
              保存
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
