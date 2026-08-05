import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getUsageOverview, QUOTA_RECHECK_DAYS } from "@/lib/queries/usageOverview";
import UsageQuotaCard from "@/components/admin/UsageQuotaCard";
import UsageHistoryTable from "@/components/admin/UsageHistoryTable";
import UsageSettingsPanel from "@/components/admin/UsageSettingsPanel";

interface AdminUsagePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminUsagePage({ params }: AdminUsagePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect("/");
  }

  const t = await getTranslations("Admin.usage");
  const overview = await getUsageOverview();

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("title")}</Typography>
        <Chip size="small" label={t(`plan.${overview.plan}`)} color={overview.plan === "free" ? "default" : "primary"} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(`periodNote.${overview.plan}`)}
      </Typography>

      {overview.quotaStale && (
        <Alert severity="info" sx={{ mb: 3 }}>{t("quotaStale", { days: QUOTA_RECHECK_DAYS })}</Alert>
      )}

      {overview.level !== "normal" && (
        <Alert
          severity={overview.level === "critical" ? "error" : overview.level === "warning" ? "warning" : "info"}
          sx={{ mb: 3 }}
        >
          {t(`level.${overview.level}.${overview.plan}`)}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <UsageQuotaCard labelKey="requests" usage={overview.requests} progress={overview.progress} />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("downloadBreakdown")}</Typography>
          <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Metric label={t("downloads")} value={overview.downloads} />
            <Metric label={t("downloadsCounted")} value={overview.downloadsCounted} />
            <Metric label={t("botDownloads")} value={overview.botDownloads} />
            <Metric label={t("botRequests")} value={overview.botRequests} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            {t("countedNote")}
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("history")}</Typography>
          <UsageHistoryTable history={overview.history} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("settings")}</Typography>
          <UsageSettingsPanel initial={overview.settings} />
        </CardContent>
      </Card>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{value.toLocaleString()}</Typography>
    </Box>
  );
}
