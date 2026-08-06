"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import GoogleChart from "./GoogleChart";
import { axisMax, baseChartOptions, seriesColor, type ChartSeriesKey } from "./chartTheme";

const HEIGHT = 260;

export type TrendSeries = {
  key: ChartSeriesKey;
  label: string;
  values: number[];
};

type Props = {
  /** x 軸のラベル。series の values と同じ長さ */
  labels: string[];
  series: TrendSeries[];
  emptyText: string;
  errorText: string;
};

/** 時系列の面グラフ。系列が複数あるため凡例を常に出す */
export default function TrendChart({ labels, series, emptyText, errorText }: Props) {
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
      lineWidth: 2,
      areaOpacity: 0.12,
      pointSize: 0,
      focusTarget: "category" as const,
      crosshair: { trigger: "both" as const, orientation: "vertical" as const, color: theme.palette.text.secondary },
      hAxis: { ...baseChartOptions(theme).hAxis, showTextEvery: Math.ceil(labels.length / 6) },
    }),
    [theme, isDark, series, labels.length]
  );

  if (labels.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return <GoogleChart type="AreaChart" rows={rows} options={options} height={HEIGHT} errorText={errorText} />;
}
