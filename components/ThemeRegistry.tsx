"use client";

import * as React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { roboto } from "@/lib/theme";
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

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === "light"
            ? {
                // Light mode palette
                primary: {
                  main: "#2563eb",
                  light: "#3b82f6",
                  dark: "#1d4ed8",
                  contrastText: "#ffffff",
                },
                secondary: {
                  main: "#059669",
                  light: "#10b981",
                  dark: "#047857",
                  contrastText: "#ffffff",
                },
                background: {
                  default: "#f8fafc",
                  paper: "#ffffff",
                },
                text: {
                  primary: "#0f172a",
                  secondary: "#475569",
                },
                surface: {
                  main: "#ffffff",
                },
              }
            : {
                // Dark mode palette
                primary: {
                  main: "#3b82f6",
                  light: "#60a5fa",
                  dark: "#2563eb",
                  contrastText: "#ffffff",
                },
                secondary: {
                  main: "#10b981",
                  light: "#34d399",
                  dark: "#059669",
                  contrastText: "#ffffff",
                },
                background: {
                  default: "#0f172a",
                  paper: "#1e293b",
                },
                text: {
                  primary: "#f8fafc",
                  secondary: "#94a3b8",
                },
                surface: {
                  main: "#1e293b",
                },
              }),
        },
        typography: {
          fontFamily: roboto.style.fontFamily,
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
        components: {
          MuiButton: {
            defaultProps: {
              size: "medium",
              disableElevation: true,
            },
            styleOverrides: {
              root: {
                textTransform: "none",
                fontWeight: 600,
                transition: "all 0.2s ease-in-out",
              },
              sizeSmall: {
                height: "32px",
                padding: "4px 12px",
                fontSize: "0.8125rem",
              },
              sizeMedium: {
                height: "40px",
                padding: "8px 16px",
                fontSize: "0.875rem",
              },
              sizeLarge: {
                height: "48px",
                padding: "10px 22px",
                fontSize: "0.9375rem",
              },
            },
          },
          MuiOutlinedInput: {
            defaultProps: { size: "small" },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                background: mode === "light" ? "#ffffff" : "#1e293b",
                border: mode === "light" ? "1px solid #e2e8f0" : "1px solid #334155",
                borderRadius: 4,
                transition: "all 0.2s ease-in-out",
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                transition: "all 0.2s ease-in-out",
              },
            },
          },
          MuiLink: {
            defaultProps: {
              color: mode === "light" ? "primary.main" : "primary.light",
            },
            styleOverrides: {
              root: {
                textDecoration: "none",
                transition: "color 0.2s ease-in-out",
                "&:hover": {
                  textDecoration: "underline",
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                fontWeight: 500,
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              size: "small",
            },
            styleOverrides: {
              root: {
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: mode === "light" ? "#cbd5e1" : "#334155" },
                },
              },
            },
          },
          MuiFormControl: {
            defaultProps: { size: "small" },
          },
          MuiSelect: {
            defaultProps: { size: "small" },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                background: mode === "light" ? "rgba(255, 255, 255, 0.85)" : "rgba(15, 23, 42, 0.75)",
                color: mode === "light" ? "#0f172a" : "#f8fafc",
                backdropFilter: "blur(8px)",
                borderBottom: mode === "light" ? "1px solid #e2e8f0" : "1px solid #334155",
                backgroundImage: "none",
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                background: mode === "light" ? "rgba(255, 255, 255, 0.85)" : "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(8px)",
                borderRight: mode === "light" ? "1px solid #e2e8f0" : "1px solid #334155",
              },
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: { borderColor: mode === "light" ? "#e2e8f0" : "#334155" },
            },
          },
        },
      }),
    [mode]
  );

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
