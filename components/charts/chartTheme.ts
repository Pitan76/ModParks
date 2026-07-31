/**
 * グラフ共通の色と Google Charts の共通オプション。
 *
 * 色は検証済みのカテゴリカルパレットから固定順で割り当てる。
 * ライト/ダークで同じ値を使うとダーク面でコントラストが落ちるため、
 * モードごとに選び直した値を持つ。
 */
import type { Theme } from "@mui/material/styles";

export type ChartSeriesKey = "downloads" | "views" | "earned" | "spent";

const SERIES_COLORS: Record<ChartSeriesKey, { light: string; dark: string }> = {
  downloads: { light: "#2a78d6", dark: "#3987e5" },
  views: { light: "#1baf7a", dark: "#199e70" },
  earned: { light: "#4a3aa7", dark: "#9085e9" },
  spent: { light: "#eb6834", dark: "#d95926" },
};

export function seriesColor(key: ChartSeriesKey, isDark: boolean): string {
  const color = SERIES_COLORS[key];
  return isDark ? color.dark : color.light;
}

/**
 * プロジェクト別など、系列名が可変のグラフに使う固定順のパレット。
 * 順番に割り当てるだけで循環はさせない。7 系列目からは「その他」へまとめる。
 */
const CATEGORICAL: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
  { light: "#008300", dark: "#008300" },
];

export const CATEGORICAL_LIMIT = CATEGORICAL.length;

export function categoricalColors(count: number, isDark: boolean): string[] {
  return CATEGORICAL.slice(0, count).map((c) => (isDark ? c.dark : c.light));
}

/**
 * 全グラフ共通の見た目。
 * 背景を透過にしてカードの面をそのまま使い、文字色は MUI のテーマから取る。
 */
export function baseChartOptions(theme: Theme) {
  const text = { color: theme.palette.text.secondary, fontSize: 12 };

  return {
    backgroundColor: "transparent",
    fontName: theme.typography.fontFamily,
    chartArea: { left: 56, right: 16, top: 16, bottom: 40 },
    legend: { position: "bottom" as const, alignment: "start" as const, textStyle: text },
    tooltip: { textStyle: { fontSize: 12 } },
    hAxis: { textStyle: text, gridlines: { color: "transparent" }, baselineColor: theme.palette.divider },
    // 値軸は必ず 0 起点にする。途中から始めると差が実際より大きく見えるため
    vAxis: {
      textStyle: text,
      minValue: 0,
      viewWindow: { min: 0 },
      baseline: 0,
      gridlines: { color: theme.palette.divider, count: 5 },
      minorGridlines: { count: 0 },
      baselineColor: theme.palette.divider,
    },
  };
}
