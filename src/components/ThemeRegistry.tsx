"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { getAppTheme } from "@/lib/theme";
import Cookies from "js-cookie";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_THEME_TYPE, resolveThemeType, storeThemeType, type ThemeType } from "@/lib/themeType";

export const ColorModeContext = React.createContext({
  mode: "dark" as "light" | "dark",
  toggleColorMode: () => {},
  setColorMode: (mode: "light" | "dark") => {},
  themeType: DEFAULT_THEME_TYPE as ThemeType,
  isNewTheme: true,
  isPlainTheme: false,
  setThemeType: (theme: ThemeType) => {},
});

export function useColorMode() {
  return React.useContext(ColorModeContext);
}

interface ThemeRegistryProps {
  children: React.ReactNode;
  initialMode?: "light" | "dark";
}

function ThemeQueryChecker({ onThemeChange }: { onThemeChange: (theme: ThemeType) => void }) {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    onThemeChange(resolveThemeType(searchParams?.get("theme")));
  }, [searchParams, onThemeChange]);

  return null;
}

export default function ThemeRegistry({ children, initialMode = "dark" }: ThemeRegistryProps) {
  const [mode, setMode] = React.useState<"light" | "dark">(initialMode);
  const [themeType, setThemeTypeState] = React.useState<ThemeType>(DEFAULT_THEME_TYPE);
  const pathname = usePathname();
  // 管理画面は作業効率を優先するため、Plain Theme の対象外とする
  const effectiveThemeType: ThemeType =
    themeType === "plain" && /^\/[^/]+\/admin(\/|$)/.test(pathname ?? "") ? "new" : themeType;

  // 初回マウント時にlocalStorageおよびURLを確認し、表示の切り替えラグを低減
  React.useEffect(() => {
    const themeParam = new URLSearchParams(window.location.search).get("theme");
    setThemeTypeState(resolveThemeType(themeParam));
  }, []);

  const colorMode = React.useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prevMode) => {
          const nextMode = prevMode === "light" ? "dark" : "light";
          Cookies.set("theme_mode", nextMode, { expires: 365, path: "/" });
          return nextMode;
        });
      },
      setColorMode: (newMode: "light" | "dark") => {
        setMode(newMode);
        Cookies.set("theme_mode", newMode, { expires: 365, path: "/" });
      },
      themeType,
      isNewTheme: effectiveThemeType !== "legacy",
      isPlainTheme: effectiveThemeType === "plain",
      setThemeType: (theme: ThemeType) => {
        setThemeTypeState(theme);
        storeThemeType(theme);
      },
    }),
    [mode, themeType, effectiveThemeType]
  );

  const theme = React.useMemo(() => getAppTheme(mode, effectiveThemeType), [mode, effectiveThemeType]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          {children}
          <React.Suspense fallback={null}>
            <ThemeQueryChecker onThemeChange={setThemeTypeState} />
          </React.Suspense>
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ColorModeContext.Provider>
  );
}
