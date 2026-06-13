"use client";

import { createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

/** ModParks テーマ — Minecraft をイメージした青・水色メインのダークテーマ */
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#3b82f6", // シンプルなブルー
      light: "#60a5fa",
      dark: "#2563eb",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#10b981", // シンプルなグリーン
      light: "#34d399",
      dark: "#059669",
      contrastText: "#ffffff",
    },
    background: {
      default: "#0f172a", // ダークネイビー
      paper: "#1e293b",   // 少し明るいネイビー
    },
    text: {
      primary: "#f8fafc",
      secondary: "#94a3b8",
    },
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
    borderRadius: 4, // 10万規模向けにシャープで高密度なデザインに変更
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: "small",
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          boxShadow: "none",
        },
        containedPrimary: {
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },

    MuiOutlinedInput: {
      defaultProps: { size: "small" },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background:   "#1e293b",
          border:       "1px solid #334155",
          borderRadius: 4,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight:   500,
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
            "& fieldset": { borderColor: "#334155" },
          },
        },
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
          backgroundImage: "none",
          boxShadow: "none",
          border: "1px solid #334155",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "#0f172a",
          borderRight: "1px solid #334155",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "#334155" },
      },
    },
  },
});

// TypeScript 拡張
declare module "@mui/material/styles" {
  interface Palette {
    surface: { main: string };
  }
  interface PaletteOptions {
    surface?: { main: string };
  }
}

export default theme;
