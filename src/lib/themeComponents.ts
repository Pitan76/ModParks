import type { ThemeOptions } from "@mui/material/styles";
import { dividerColor } from "@/lib/themePalette";

/**
 * MUI コンポーネントの既定値と上書き。
 *
 * new テーマは legacy の見た目の上に「角丸を減らす・影を消す・枠線を細くする」を
 * 重ねる形なので、legacy の指定を土台にして差分だけを後置きしている。
 */

/** new テーマの面の色（背景・枠線） */
const newSurface = (mode: "light" | "dark") => ({
  border: mode === "light" ? "#e0e0e0" : "#3c4043",
  appBar: mode === "light" ? "rgba(241, 245, 249, 0.85)" : "rgba(11, 19, 41, 0.80)",
});

/** legacy テーマの面の色 */
const legacySurface = (mode: "light" | "dark") => ({
  paper: mode === "light" ? "#ffffff" : "#1e293b",
  border: mode === "light" ? "#e2e8f0" : "#334155",
  translucent: mode === "light" ? "rgba(255, 255, 255, 0.85)" : "rgba(15, 23, 42, 0.75)",
});

export function getThemeComponents(mode: "light" | "dark", isNewTheme: boolean): ThemeOptions["components"] {
  const legacy = legacySurface(mode);
  const next = newSurface(mode);

  return {
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
          ...(isNewTheme ? { borderRadius: 4, boxShadow: "none" } : {}),
        },
        sizeSmall: { height: "32px", padding: "4px 12px", fontSize: "0.8125rem" },
        sizeMedium: { height: "40px", padding: "8px 16px", fontSize: "0.875rem" },
        sizeLarge: { height: "48px", padding: "10px 22px", fontSize: "0.9375rem" },
      },
    },
    MuiOutlinedInput: {
      defaultProps: { size: "small" },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: legacy.paper,
          border: `1px solid ${legacy.border}`,
          borderRadius: 4,
          transition: "all 0.2s ease-in-out",
          ...(isNewTheme
            ? {
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${next.border}`,
                borderRadius: 0,
                boxShadow: "none",
              }
            : {}),
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { transition: "all 0.2s ease-in-out" },
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
          "&:hover": { textDecoration: "underline" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          ...(isNewTheme ? { borderRadius: 4, borderWidth: "1px", fontWeight: 400 } : {}),
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiFormControl: {
      defaultProps: { size: "small" },
    },
    MuiSelect: {
      defaultProps: { size: "small" },
    },
    MuiAutocomplete: {
      defaultProps: { disablePortal: true },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: legacy.translucent,
          color: mode === "light" ? "#0f172a" : "#f8fafc",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${legacy.border}`,
          backgroundImage: "none",
          ...(isNewTheme
            ? {
                background: next.appBar,
                borderBottom: `1px solid ${next.border}`,
                boxShadow: "none",
              }
            : {}),
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: legacy.translucent,
          backdropFilter: "blur(8px)",
          borderRight: `1px solid ${legacy.border}`,
          ...(isNewTheme
            ? {
                background: next.appBar,
                borderRight: `1px solid ${next.border}`,
              }
            : {}),
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: dividerColor(mode) },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        html: { colorScheme: mode },
      },
    },
  };
}
