"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import GoogleChart from "./GoogleChart";
import { axisMax, baseChartOptions, seriesColor, type ChartSeriesKey } from "./chartTheme";

const HEIGHT = 260;

export type BarSeries = {
  key: ChartSeriesKey;
  label: string;
  values: number[];
};

type Props = {
  labels: string[];
  series: BarSeries[];
  emptyText: string;
  errorText: string;
};

/** 期間ごとの複数系列を並べた縦棒グラフ */
export default function GroupedBarChart({ labels, series, emptyText, errorText }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const rows = useMemo(
    () => [
      ["", ...series.map((s) => s.label)],
      ...labels.map((label, i) => [label, ...series.map((s) => s.values[i])]),
    ],
    [labels, series]
  );

  const options = useMemo(
    () => ({
      ...baseChartOptions(theme),
      vAxis: {
        ...baseChartOptions(theme).vAxis,
        viewWindow: { min: 0, max: axisMax(series.flatMap((s) => s.values)) },
      },
      height: HEIGHT,
      colors: series.map((s) => seriesColor(s.key, isDark)),
      bar: { groupWidth: "62%" },
      focusTarget: "category" as const,
    }),
    [theme, isDark, series]
  );

  if (labels.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return <GoogleChart type="ColumnChart" rows={rows} options={options} height={HEIGHT} errorText={errorText} />;
}
