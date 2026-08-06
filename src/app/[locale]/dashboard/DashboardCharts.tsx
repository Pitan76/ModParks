import Grid from "@mui/material/Grid";
import { getTranslations } from "next-intl/server";
import ChartCard from "@/components/charts/ChartCard";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { getAppSettings } from "@/lib/config/readSettings";
import { getDownloadTrend, getProjectDownloadSeries, getRewardTrend } from "@/lib/queries/dashboardMetrics";
import DownloadPanel from "./DownloadPanel";

/** 粒度の切替をクライアントで完結させるため、最長期間ぶんをまとめて取る */
const TREND_DAYS = 365;
const REWARD_MONTHS = 12;

/** ダウンロード・閲覧・リワードの推移をグラフで見せるダッシュボードのセクション */
export default async function DashboardCharts({ userId, locale }: { userId: string; locale: string }) {
  const t = await getTranslations("Dashboard.charts");
  const [trend, projectSeries, rewards, settings] = await Promise.all([
    getDownloadTrend(userId, TREND_DAYS),
    getProjectDownloadSeries(userId, TREND_DAYS, 5, t("otherProjects")),
    getRewardTrend(userId, REWARD_MONTHS),
    getAppSettings(),
  ]);

  const monthFormat = new Intl.DateTimeFormat(locale, { year: "2-digit", month: "short", timeZone: "UTC" });

  return (
    <>
      <DownloadPanel trend={trend} projectSeries={projectSeries} />

      {settings.creatorRewardEnabled && (
        <Grid container spacing={{ xs: 3, md: 4 }} sx={{ mb: { xs: 3, md: 4 } }}>
          <Grid size={12}>
            <ChartCard title={t("rewardTrend", { months: REWARD_MONTHS })}>
              <GroupedBarChart
                labels={rewards.map((r) => monthFormat.format(new Date(`${r.period}-01T00:00:00Z`)))}
                series={[
                  { key: "earned", label: t("earned"), values: rewards.map((r) => r.earned) },
                  { key: "spent", label: t("spent"), values: rewards.map((r) => r.spent) },
                ]}
                emptyText={t("noData")}
                errorText={t("loadError")}
              />
            </ChartCard>
          </Grid>
        </Grid>
      )}
    </>
  );
}
