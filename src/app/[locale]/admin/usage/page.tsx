import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getUsageOverview, QUOTA_RECHECK_DAYS } from "@/lib/queries/usageOverview";
import UsageQuotaCard from "@/components/admin/UsageQuotaCard";
import UsageHistoryTable from "@/components/admin/UsageHistoryTable";
import UsageSettingsPanel from "@/components/admin/UsageSettingsPanel";
import type { AnalyticsStatus } from "@/lib/usage/analyticsStatus";
import { redirect } from "@/lib/i18n/routing";

interface AdminUsagePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminUsagePage({ params }: AdminUsagePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect({ href: "/", locale: locale });
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

      {overview.measurementMissing && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t("measurementMissing")}
          <MeasurementDiagnosis t={t} locale={locale} status={overview.analyticsStatus} />
        </Alert>
      )}

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

          <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: "wrap", mt: 3 }}>
            <Metric label={t("ownRequests")} value={overview.ownRequests} />
            <Metric
              label={t("otherRequests")}
              value={overview.ownRequests === null ? null : Math.max(overview.requests.used - overview.ownRequests, 0)}
            />
            <Metric label={t("sampledRequests")} value={overview.sampledRequests} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            {t("ownNote")} {t("sampledNote")}
          </Typography>
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

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * 最後の取得試行が何で落ちたかを出す。
 *
 * 取得は Cron の中で走るため、原文のメッセージまで見せないと
 * 権限不足なのか停止中なのかの切り分けができない。
 */
function MeasurementDiagnosis({ t, locale, status }: { t: Translate; locale: string; status: AnalyticsStatus | null }) {
  if (!status) return <Detail text={t("analyticsFailure.neverRun")} />;
  if (!status.failure) return <Detail text={t("analyticsFailure.lastOkButEmpty")} />;

  const { kind, status: httpStatus, detail } = status.failure;
  const at = new Date(status.at).toLocaleString(locale);
  const reason = t(`analyticsFailure.${kind}`);
  const head = httpStatus ? `${reason} (HTTP ${httpStatus})` : reason;

  return (
    <>
      <Detail text={t("analyticsFailure.lastAttempt", { at, reason: head })} />
      {detail && (
        <Typography
          variant="caption"
          component="pre"
          sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.85 }}
        >
          {detail}
        </Typography>
      )}
    </>
  );
}

function Detail({ text }: { text: string }) {
  return <Typography variant="body2" sx={{ mt: 1 }}>{text}</Typography>;
}

/** null は未取得。0 と同じ見た目にすると「消費なし」と誤読されるため区別する */
function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value === null ? "-" : value.toLocaleString()}
      </Typography>
    </Box>
  );
}
