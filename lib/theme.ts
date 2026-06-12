"use client";

import { createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

/** ModParks テーマ — Minecraft をイメージした青・水色メインのダークテーマ */
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main:        "#38bdf8", // Sky blue
      light:       "#7dd3fc",
      dark:        "#0284c7",
      contrastText: "#082f49",
    },
    secondary: {
      main:        "#60a5fa", // Blue
      light:       "#93c5fd",
      dark:        "#2563eb",
      contrastText: "#1e3a8a",
    },
    background: {
      default: "#101a30",  // Slate 900
      paper:   "#1e293b",  // Slate 800
    },
    surface: {
      main: "#334155", // Slate 700
    },
    text: {
      primary:   "#f8fafc",
      secondary: "#94a3b8",
      disabled:  "#64748b",
    },
    error: {
      main: "#f87171",
    },
    warning: {
      main: "#fbbf24",
    },
    success: {
      main: "#38bdf8",
    },
    divider: "#334155",
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
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight:    600,
          borderRadius:  8,
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background:   "#1e293b",
          border:       "1px solid #334155",
          borderRadius: 12,
          transition:   "border-color 0.2s",
          "&:hover": {
            borderColor: "#38bdf8af",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight:   500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#334155" },
            "&:hover fieldset":  { borderColor: "#38bdf8" },
            "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:  "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(12px)",
          borderBottom:   "1px solid #334155",
          boxShadow:      "none",
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
