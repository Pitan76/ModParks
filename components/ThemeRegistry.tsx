"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { getAppTheme } from "@/lib/theme";
import Cookies from "js-cookie";
import { useSearchParams } from "next/navigation";

export const ColorModeContext = React.createContext({
  mode: "dark" as "light" | "dark",
  toggleColorMode: () => {},
  isNewTheme: true,
  setThemeType: (theme: "new" | "legacy") => {},
});

export function useColorMode() {
  return React.useContext(ColorModeContext);
}

interface ThemeRegistryProps {
  children: React.ReactNode;
  initialMode?: "light" | "dark";
}

function ThemeQueryChecker({ onThemeChange }: { onThemeChange: (isNew: boolean) => void }) {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const themeParam = searchParams?.get("theme");
    if (themeParam === "new") {
      onThemeChange(true);
      try {
        window.localStorage.setItem("theme_type", "new");
      } catch (e) {
        // ignore
      }
    } else if (themeParam === "legacy") {
      onThemeChange(false);
      try {
        window.localStorage.setItem("theme_type", "legacy");
      } catch (e) {
        // ignore
      }
    } else {
      // ローカル保存設定を参照し、明示的レガシー設定以外は新テーマにする
      try {
        const savedTheme = window.localStorage.getItem("theme_type");
        onThemeChange(savedTheme !== "legacy");
      } catch (e) {
        onThemeChange(true);
      }
    }
  }, [searchParams, onThemeChange]);

  return null;
}

export default function ThemeRegistry({ children, initialMode = "dark" }: ThemeRegistryProps) {
  const [mode, setMode] = React.useState<"light" | "dark">(initialMode);
  const [isNewTheme, setIsNewTheme] = React.useState<boolean>(true);

  // 初回マウント時にlocalStorageおよびURLを確認し、表示の切り替えラグを低減
  React.useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("theme_type");
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get("theme");
      if (themeParam === "legacy" || (savedTheme === "legacy" && themeParam !== "new")) {
        setIsNewTheme(false);
      } else {
        setIsNewTheme(true);
      }
    } catch (e) {
      setIsNewTheme(true);
    }
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
      isNewTheme,
      setThemeType: (theme: "new" | "legacy") => {
        setIsNewTheme(theme === "new");
        try {
          window.localStorage.setItem("theme_type", theme);
        } catch (e) {
          // ignore
        }
      },
    }),
    [mode, isNewTheme]
  );

  const theme = React.useMemo(() => getAppTheme(mode, isNewTheme), [mode, isNewTheme]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          {children}
          <React.Suspense fallback={null}>
            <ThemeQueryChecker onThemeChange={setIsNewTheme} />
          </React.Suspense>
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ColorModeContext.Provider>
  );
}
