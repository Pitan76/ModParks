import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import SettingsSection from "@/components/settings/SettingsSection";
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

export default async function RewardSettingsPage() {
  const session = await auth();
  const t = await getTranslations("CreatorReward");
  const userId = session!.user!.id!;

  const [settings, balance, transactions, optIn] = await Promise.all([
    getAppSettings(),
    getPointBalance(userId),
    listPointTransactions(userId),
    getCreatorRewardOptIn(userId),
  ]);

  return (
    <SettingsSection title={t("title")}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, mt: -2 }}>
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
    </SettingsSection>
  );
}
