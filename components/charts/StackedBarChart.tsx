"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import GoogleChart from "./GoogleChart";
import { axisMax, baseChartOptions, categoricalColors } from "./chartTheme";

const HEIGHT = 260;

type Props = {
  labels: string[];
  seriesNames: string[];
  /** labels と同じ並びで、系列ごとの値 */
  values: number[][];
  emptyText: string;
  errorText: string;
};

/** 内訳の積み上げ縦棒グラフ。系列は凡例とツールチップで識別する */
export default function StackedBarChart({ labels, seriesNames, values, emptyText, errorText }: Props) {
  const theme = useTheme();

  const rows = useMemo(
    () => [["", ...seriesNames], ...labels.map((label, i) => [label, ...values[i]])],
    [labels, seriesNames, values]
  );

  const options = useMemo(
    () => ({
      ...baseChartOptions(theme),
      // 積み上げなので上端は各バケットの合計で決まる
      vAxis: {
        ...baseChartOptions(theme).vAxis,
        viewWindow: { min: 0, max: axisMax(values.map((v) => v.reduce((a, b) => a + b, 0))) },
      },
      height: HEIGHT,
      colors: categoricalColors(seriesNames.length, theme.palette.mode === "dark"),
      isStacked: true,
      bar: { groupWidth: "70%" },
      focusTarget: "category" as const,
    }),
    [theme, seriesNames.length, values]
  );

  if (labels.length === 0 || seriesNames.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return <GoogleChart type="ColumnChart" rows={rows} options={options} height={HEIGHT} errorText={errorText} />;
}
