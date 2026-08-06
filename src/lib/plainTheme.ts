"use client";

import type { ThemeOptions } from "@mui/material/styles";

/** OS標準フォントのみを使用し、Webフォント読み込みを発生させない */
export const PLAIN_FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', 'Noto Sans JP', sans-serif";

/**
 * Plain Themeの最小配色。
 * ブラウザ標準の見た目に寄せるため、色数は背景・文字・リンク・境界のみに留める。
 */
const PLAIN_COLORS = {
  light: {
    background: "#ffffff",
    paper: "#ffffff",
    text: "#000000",
    textSecondary: "#555555",
    link: "#0000ee",
    border: "#767676",
  },
  dark: {
    background: "#121212",
    paper: "#121212",
    text: "#e8e8e8",
    textSecondary: "#a0a0a0",
    link: "#9e9eff",
    border: "#767676",
  },
} as const;

const NO_SHADOWS = Array.from({ length: 25 }, () => "none") as ThemeOptions["shadows"];

/**
 * 標準テーマへ合成する軽量化オーバーライドを返す。
 * 角丸・影・アニメーション・背景ぼかしを除去し、色はcolor-schemeを軸とした最小限に置き換える。
 */
export function getPlainThemeOverrides(mode: "light" | "dark"): ThemeOptions {
  const c = PLAIN_COLORS[mode];
  return {
    spacing: 8,
    shape: { borderRadius: 0 },
    shadows: NO_SHADOWS,
    transitions: { create: () => "none" },
    palette: {
      mode,
      divider: c.border,
      primary: { main: c.link, contrastText: c.background },
      secondary: { main: c.link, contrastText: c.background },
      background: { default: c.background, paper: c.paper },
      text: { primary: c.text, secondary: c.textSecondary },
      surface: { main: c.paper },
    },
    typography: {
      fontFamily: PLAIN_FONT_FAMILY,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: { backgroundColor: c.background, color: c.text },
          "a:focus-visible, button:focus-visible, [tabindex]:focus-visible": { outline: "2px solid currentColor" },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: { borderRadius: 0, boxShadow: "none", transition: "none", textTransform: "none", fontWeight: 400 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${c.border}`,
            borderRadius: 0,
            boxShadow: "none",
            transition: "none",
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: "none", boxShadow: "none", borderRadius: 0 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: c.background,
            color: c.text,
            backdropFilter: "none",
            borderBottom: `1px solid ${c.border}`,
            boxShadow: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { background: c.background, backdropFilter: "none", borderRight: `1px solid ${c.border}` },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 0, fontWeight: 400 } } },
      MuiAvatar: { styleOverrides: { root: { borderRadius: 0 } } },
      MuiTooltip: { defaultProps: { disableInteractive: true } },
      MuiSkeleton: { defaultProps: { animation: false } },
      MuiListItemButton: { styleOverrides: { root: { transition: "none" } } },
      MuiLink: { styleOverrides: { root: { textDecoration: "underline" } } },
    },
  };
}
