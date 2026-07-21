"use client";

import { createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const getAppTheme = (mode: "light" | "dark", isNewTheme: boolean = false) => createTheme({
  isNewTheme,
  spacing: isNewTheme ? 10 : 8,
  palette: {
    mode,
    ...(isNewTheme
      ? (mode === "light"
        ? {
            primary: {
              main: "#1a73e8", // Google Blue
              light: "#d2e3fc",
              dark: "#1557b0",
              contrastText: "#ffffff",
            },
            secondary: {
              main: "#0b57d0",
              light: "#4285f4",
              dark: "#0842a0",
              contrastText: "#ffffff",
            },
            background: {
              default: "#f1f5f9", // Slate Light Gray
              paper: "#ffffff",
            },
            text: {
              primary: "#1f1f1f", // Google Text Dark
              secondary: "#5f6368", // Google Text Secondary
            },
            surface: {
              main: "#ffffff",
            },
          }
        : {
            primary: {
              main: "#8ab4f8", // Google Light Blue for Dark Mode
              light: "#adcbfa",
              dark: "#669df6",
              contrastText: "#1f1f1f",
            },
            secondary: {
              main: "#7ca7f8",
              light: "#aecbfa",
              dark: "#4c8cf5",
              contrastText: "#1f1f1f",
            },
            background: {
              default: "#0b1329", // 紺色 (Midnight Navy)
              paper: "#16223f", // サーフェス紺色
            },
            text: {
              primary: "#f1f5f9",
              secondary: "#94a3b8",
            },
            surface: {
              main: "#16223f",
            },
          })
      : (mode === "light"
        ? {
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
          })),
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
          ...(isNewTheme ? {
            borderRadius: 4,
            boxShadow: "none",
          } : {}),
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
          transition:   "all 0.2s ease-in-out",
          ...(isNewTheme ? {
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${mode === "light" ? "#e0e0e0" : "#3c4043"}`,
            borderRadius: 0,
            boxShadow: "none",
          } : {})
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
          fontWeight:   500,
          ...(isNewTheme ? {
            borderRadius: 4,
            borderWidth: "1px",
            fontWeight: 400,
          } : {})
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: "small",
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: mode === "light" ? "rgba(255, 255, 255, 0.85)" : "rgba(15, 23, 42, 0.75)",
          color: mode === "light" ? "#0f172a" : "#f8fafc",
          backdropFilter: "blur(8px)",
          borderBottom: mode === "light" ? "1px solid #e2e8f0" : "1px solid #334155",
          backgroundImage: "none",
          ...(isNewTheme ? {
            background: mode === "light" ? "rgba(241, 245, 249, 0.85)" : "rgba(11, 19, 41, 0.80)",
            borderBottom: `1px solid ${mode === "light" ? "#e0e0e0" : "#3c4043"}`,
            boxShadow: "none",
          } : {})
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: mode === "light" ? "rgba(255, 255, 255, 0.85)" : "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          borderRight: mode === "light" ? "1px solid #e2e8f0" : "1px solid #334155",
          ...(isNewTheme ? {
            background: mode === "light" ? "rgba(241, 245, 249, 0.85)" : "rgba(11, 19, 41, 0.80)",
            borderRight: `1px solid ${mode === "light" ? "#e0e0e0" : "#3c4043"}`,
          } : {})
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { 
          borderColor: isNewTheme 
            ? (mode === "light" ? "#e0e0e0" : "#3c4043") 
            : (mode === "light" ? "#e2e8f0" : "#334155") 
        },
      },
    },
  },
});

// TypeScript 拡張
declare module "@mui/material/styles" {
  interface Theme {
    isNewTheme: boolean;
  }
  interface ThemeOptions {
    isNewTheme?: boolean;
  }
  interface Palette {
    surface: { main: string };
  }
  interface PaletteOptions {
    surface?: { main: string };
  }
}


