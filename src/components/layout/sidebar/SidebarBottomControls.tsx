"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import LanguageIcon from "@mui/icons-material/Language";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { LOCALE_OPTIONS } from "@/lib/i18n/localeLabels";
import { storeLocaleCookie } from "@/lib/i18n/localeCookie";
import { useLocale } from "next-intl";
import { useColorMode } from "@/components/ThemeRegistry";

/**
 * サイドバー最下部の言語・テーマ切替。
 *
 * ログイン時は設定画面に集約するので出さない。デスクトップはヘッダー側に持つため、
 * 表示するのは未ログインかつモバイルのときだけ。
 */
const SidebarBottomControls = () => {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { mode, toggleColorMode } = useColorMode();

  const handleLocaleChange = (newLocale: string) => {
    // 接頭辞なしルート（設定など）はCookieが言語の手がかりになるため、遷移前に更新する
    storeLocaleCookie(newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", mt: "auto", flexShrink: 0 }}>
      <Divider />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Select
            id="locale-select-sidebar"
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value as string)}
            size="small"
            variant="outlined"
            renderValue={(v) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <LanguageIcon fontSize="small" />
                <Typography variant="body2" sx={{ mt: "1px", fontWeight: 500 }}>
                  {v.toUpperCase()}
                </Typography>
              </Box>
            )}
            sx={{
              flexGrow: 1,
              color: "text.secondary",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "text.secondary" },
              ".MuiSelect-icon": { color: "text.secondary" },
            }}
          >
            {LOCALE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </Select>

          <IconButton
            onClick={toggleColorMode}
            color="inherit"
            size="small"
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: "6px" }}
          >
            {mode === "light" ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default SidebarBottomControls;
