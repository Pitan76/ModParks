"use client";

import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { deepmerge } from "@mui/utils";
import { Roboto } from "next/font/google";
import type { ThemeType } from "@/lib/themeType";
import { getPlainThemeOverrides, PLAIN_FONT_FAMILY } from "@/lib/plainTheme";
import { getPalette } from "@/lib/themePalette";
import { getThemeComponents } from "@/lib/themeComponents";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

/**
 * テーマ種別とカラーモードからMUIテーマを生成する。
 * Plain Themeの軽量化設定は、spacingやpaletteが正しく解決されるよう生成前にマージする。
 */
export const getAppTheme = (mode: "light" | "dark", themeType: ThemeType = "legacy") => {
  const isPlainTheme = themeType === "plain";
  const base = getBaseOptions(mode, themeType !== "legacy", isPlainTheme);
  if (!isPlainTheme) return createTheme(base);
  return createTheme(deepmerge(base, getPlainThemeOverrides(mode)));
};

const getBaseOptions = (mode: "light" | "dark", isNewTheme: boolean, isPlainTheme: boolean): ThemeOptions => ({
  isNewTheme,
  isPlainTheme,
  spacing: isNewTheme ? 10 : 8,
  palette: getPalette(mode, isNewTheme),
  typography: {
    fontFamily: isPlainTheme ? PLAIN_FONT_FAMILY : roboto.style.fontFamily,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 4,
  },
  components: getThemeComponents(mode, isNewTheme),
});

declare module "@mui/material/styles" {
  interface Theme {
    isNewTheme: boolean;
    isPlainTheme: boolean;
  }
  interface ThemeOptions {
    isNewTheme?: boolean;
    isPlainTheme?: boolean;
  }
  interface Palette {
    surface: { main: string };
  }
  interface PaletteOptions {
    surface?: { main: string };
  }
}
