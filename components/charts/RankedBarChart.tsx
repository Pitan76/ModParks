"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import GoogleChart from "./GoogleChart";
import { baseChartOptions, seriesColor, type ChartSeriesKey } from "./chartTheme";

const ROW_HEIGHT = 44;
const CHART_PADDING = 48;

export type RankedBarItem = {
  label: string;
  value: number;
};

type Props = {
  items: RankedBarItem[];
  seriesKey: ChartSeriesKey;
  valueLabel: string;
  emptyText: string;
  errorText: string;
};

/** 順位付きの横棒グラフ。単一系列なので凡例は出さず、値を棒の先に直接出す */
export default function RankedBarChart({ items, seriesKey, valueLabel, emptyText, errorText }: Props) {
  const theme = useTheme();
  const height = items.length * ROW_HEIGHT + CHART_PADDING;

  const rows = useMemo(
    () => [["", valueLabel, { role: "annotation" }], ...items.map((i) => [i.label, i.value, i.value.toLocaleString()])],
    [items, valueLabel]
  );

  const options = useMemo(() => {
    const base = baseChartOptions(theme);
    return {
      ...base,
      height,
      chartArea: { left: 120, right: 48, top: 8, bottom: 32 },
      colors: [seriesColor(seriesKey, theme.palette.mode === "dark")],
      legend: { position: "none" as const },
      bar: { groupWidth: "62%" },
      hAxis: { ...base.vAxis },
      vAxis: { ...base.hAxis },
      annotations: { alwaysOutside: true, textStyle: { fontSize: 12, color: theme.palette.text.secondary } },
    };
  }, [theme, seriesKey, height]);

  if (items.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return <GoogleChart type="BarChart" rows={rows} options={options} height={height} errorText={errorText} />;
}
