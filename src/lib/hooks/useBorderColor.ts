"use client";

import { useColorMode } from "@/components/ThemeRegistry";

/**
 * Drawer / Divider と同一の枠線色を返す。
 * theme.ts のパレットと一致させる必要があり、複数箇所で同じ分岐が必要になるため共通化している。
 */
export function useBorderColor(): string {
  const { mode, isNewTheme, isPlainTheme } = useColorMode();
  const isLight = mode === "light";

  if (isPlainTheme) return "#767676";
  if (isNewTheme) return isLight ? "#e0e0e0" : "#3c4043";
  return isLight ? "#e2e8f0" : "#334155";
}
