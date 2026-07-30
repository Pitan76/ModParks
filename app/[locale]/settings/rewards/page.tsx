import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { getPointBalance, listPointTransactions } from "@/lib/services/points";
import { getCreatorRewardOptIn } from "@/lib/actions/creatorReward";
import RewardOptInSwitch from "@/components/reward/RewardOptInSwitch";
import PointHistoryTable from "@/components/reward/PointHistoryTable";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CreatorReward" });
  return { title: t("title") };
}

export default async function RewardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("CreatorReward");

  const [settings, balance, transactions, optIn] = await Promise.all([
    getAppSettings(),
    getPointBalance(session.user.id),
    listPointTransactions(session.user.id),
    getCreatorRewardOptIn(session.user.id),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
        {t("title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {t("description")}
      </Typography>

      {!settings.creatorRewardEnabled && (
        <Alert severity="info" sx={{ mb: 3 }}>{t("featureDisabled")}</Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">{t("balance")}</Typography>
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            {t("points", { count: balance.balance })}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t("lifetimeEarned")}
              </Typography>
              <Typography variant="h6">{balance.lifetimeEarned}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t("lifetimeSpent")}
              </Typography>
              <Typography variant="h6">{balance.lifetimeSpent}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t("participation")}</Typography>
          <RewardOptInSwitch initialOptIn={optIn} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t("history")}</Typography>
          <PointHistoryTable transactions={transactions} />
        </CardContent>
      </Card>
    </Container>
  );
}
