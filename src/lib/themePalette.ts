import type { PaletteOptions } from "@mui/material/styles";

/**
 * テーマごとの配色。
 *
 * legacy（従来）と new（Google 風）で色そのものが違い、さらに light / dark がある。
 * 4 通りを 1 つの三項演算子の入れ子で書くと差分が読めなくなるため、名前を付けて分けている。
 */

const NEW_LIGHT: PaletteOptions = {
  primary: { main: "#1a73e8", light: "#d2e3fc", dark: "#1557b0", contrastText: "#ffffff" },
  secondary: { main: "#0b57d0", light: "#4285f4", dark: "#0842a0", contrastText: "#ffffff" },
  background: { default: "#f1f5f9", paper: "#ffffff" },
  text: { primary: "#1f1f1f", secondary: "#5f6368" },
  surface: { main: "#ffffff" },
};

const NEW_DARK: PaletteOptions = {
  primary: { main: "#8ab4f8", light: "#adcbfa", dark: "#669df6", contrastText: "#1f1f1f" },
  secondary: { main: "#7ca7f8", light: "#aecbfa", dark: "#4c8cf5", contrastText: "#1f1f1f" },
  background: { default: "#0b1329", paper: "#16223f" },
  text: { primary: "#f1f5f9", secondary: "#94a3b8" },
  surface: { main: "#16223f" },
};

const LEGACY_LIGHT: PaletteOptions = {
  primary: { main: "#2563eb", light: "#3b82f6", dark: "#1d4ed8", contrastText: "#ffffff" },
  secondary: { main: "#059669", light: "#10b981", dark: "#047857", contrastText: "#ffffff" },
  background: { default: "#f8fafc", paper: "#ffffff" },
  text: { primary: "#0f172a", secondary: "#475569" },
  surface: { main: "#ffffff" },
};

const LEGACY_DARK: PaletteOptions = {
  primary: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb", contrastText: "#ffffff" },
  secondary: { main: "#10b981", light: "#34d399", dark: "#059669", contrastText: "#ffffff" },
  background: { default: "#0f172a", paper: "#1e293b" },
  text: { primary: "#f8fafc", secondary: "#94a3b8" },
  surface: { main: "#1e293b" },
};

/** 罫線の色。divider と MuiDivider で同じ値を使う */
export const dividerColor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)";

export function getPalette(mode: "light" | "dark", isNewTheme: boolean): PaletteOptions {
  const variant = isNewTheme
    ? (mode === "light" ? NEW_LIGHT : NEW_DARK)
    : (mode === "light" ? LEGACY_LIGHT : LEGACY_DARK);

  return { mode, divider: dividerColor(mode), ...variant };
}
