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
  isNewTheme: false,
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
        window.sessionStorage.setItem("theme", "new");
      } catch (e) {
        // ignore
      }
    } else if (themeParam === "default") {
      onThemeChange(false);
      try {
        window.sessionStorage.removeItem("theme");
      } catch (e) {
        // ignore
      }
    } else {
      // セッション中の遷移でもテーマがリセットされないようにsessionStorageを参照
      try {
        const savedTheme = window.sessionStorage.getItem("theme");
        onThemeChange(savedTheme === "new");
      } catch (e) {
        onThemeChange(false);
      }
    }
  }, [searchParams, onThemeChange]);

  return null;
}

export default function ThemeRegistry({ children, initialMode = "dark" }: ThemeRegistryProps) {
  const [mode, setMode] = React.useState<"light" | "dark">(initialMode);
  const [isNewTheme, setIsNewTheme] = React.useState<boolean>(false);

  // 初回マウント時にsessionStorageおよびURLを確認し、表示の切り替えラグを低減
  React.useEffect(() => {
    try {
      const savedTheme = window.sessionStorage.getItem("theme");
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get("theme");
      if (themeParam === "new" || (savedTheme === "new" && themeParam !== "default")) {
        setIsNewTheme(true);
      }
    } catch (e) {
      // ignore
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
    }),
    [mode, isNewTheme]
  );

  const theme = React.useMemo(() => getAppTheme(mode, isNewTheme), [mode, isNewTheme]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
          <React.Suspense fallback={null}>
            <ThemeQueryChecker onThemeChange={setIsNewTheme} />
          </React.Suspense>
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ColorModeContext.Provider>
  );
}
