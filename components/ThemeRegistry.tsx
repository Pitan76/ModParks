"use client";

import * as React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { getAppTheme } from "@/lib/theme";
import Cookies from "js-cookie";

export const ColorModeContext = React.createContext({
  mode: "dark" as "light" | "dark",
  toggleColorMode: () => {},
});

export function useColorMode() {
  return React.useContext(ColorModeContext);
}

interface ThemeRegistryProps {
  children: React.ReactNode;
  initialMode?: "light" | "dark";
}

export default function ThemeRegistry({ children, initialMode = "dark" }: ThemeRegistryProps) {
  const [mode, setMode] = React.useState<"light" | "dark">(initialMode);

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
    }),
    [mode]
  );

  const theme = React.useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ColorModeContext.Provider>
  );
}
