"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useLocale, useTranslations } from "next-intl";
import ChartCard from "@/components/charts/ChartCard";
import TrendChart from "@/components/charts/TrendChart";
import StackedBarChart from "@/components/charts/StackedBarChart";
import RankedBarChart from "@/components/charts/RankedBarChart";
import { bucketize, bucketLabel, sumSeries, GRANULARITIES, type Granularity } from "@/components/charts/metricBuckets";
import type { DailyMetricPoint, ProjectSeries } from "@/lib/queries/dashboardMetrics";

type Props = {
  trend: DailyMetricPoint[];
  projectSeries: ProjectSeries;
};

/**
 * ダウンロード系グラフのまとまり。
 * 粒度の切替はサーバーへ問い合わせず、受け取った日次データを畳んで作る。
 */
export default function DownloadPanel({ trend, projectSeries }: Props) {
  const t = useTranslations("Dashboard.charts");
  const locale = useLocale();
  const [granularity, setGranularity] = useState<Granularity>("day");

  const totalBuckets = useMemo(
    () => bucketize(trend.map((p) => ({ date: p.date, values: [p.downloads, p.views] })), granularity),
    [trend, granularity]
  );

  const projectRows = useMemo(
    () => projectSeries.rows.map((r) => ({ date: r.date, values: r.counts })),
    [projectSeries]
  );

  const projectBuckets = useMemo(() => bucketize(projectRows, granularity), [projectRows, granularity]);

  const rankedItems = useMemo(() => {
    const totals = sumSeries(projectRows, granularity, projectSeries.names.length);
    return projectSeries.names
      .map((label, i) => ({ label, value: totals[i] }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [projectRows, granularity, projectSeries.names]);

  const labels = totalBuckets.map((b) => bucketLabel(b, locale));
  const periodTitle = t(`period.${granularity}`);

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={granularity}
          onChange={(_, value: Granularity | null) => value && setGranularity(value)}
          aria-label={t("granularityLabel")}
        >
          {GRANULARITIES.map((g) => (
            <ToggleButton key={g} value={g} sx={{ px: 2, textTransform: "none" }}>
              {t(`granularity.${g}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={{ xs: 3, md: 4 }} sx={{ mb: { xs: 3, md: 4 } }}>
        <Grid size={12}>
          <ChartCard title={t("downloadTrend", { period: periodTitle })}>
            <TrendChart
              labels={labels}
              series={[
                { key: "downloads", label: t("downloads"), values: totalBuckets.map((b) => b.values[0]) },
                { key: "views", label: t("views"), values: totalBuckets.map((b) => b.values[1]) },
              ]}
              emptyText={t("noData")}
              errorText={t("loadError")}
            />
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title={t("byProject", { period: periodTitle })}>
            <StackedBarChart
              labels={projectBuckets.map((b) => bucketLabel(b, locale))}
              seriesNames={projectSeries.names}
              values={projectBuckets.map((b) => b.values)}
              emptyText={t("noData")}
              errorText={t("loadError")}
            />
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title={t("topProjects", { period: periodTitle })}>
            <RankedBarChart
              items={rankedItems}
              seriesKey="downloads"
              valueLabel={t("downloads")}
              emptyText={t("noData")}
              errorText={t("loadError")}
            />
          </ChartCard>
        </Grid>
      </Grid>
    </>
  );
}
